import React from 'react';
import { Card, CardContent } from "../ui/card";
import {
  Activity,
  Calendar,
  DollarSign,
  Heart,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { compareIds } from '../../lib/utils';
import { includesAnimalInAppointment, normalizeAppointmentForAnalysis } from '../../lib/appointments';

// Convert value to number, handling string currency formats
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ZootechnicalIndicators({ animal, appointments = [], allAnimals = [] }) {
  // Calculate indicators
  const currentAnimalId = animal?.id || animal?._id;
  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  const animalAppointments = normalizedAppointments.filter((appointmentItem) => includesAnimalInAppointment(appointmentItem, currentAnimalId));
  
  // Total appointments
  const totalAppointments = animalAppointments.length;
  
  // Total veterinary cost
  const totalVetCost = animalAppointments.reduce((sum, a) => sum + toNumber(a.total_amount || 0), 0);
  
  // Reproductive indicators (only for females)
  let reproductiveIndicators = null;
  if (animal.sex === 'femea') {
    const reproductiveAppointments = animalAppointments.filter(a => a.type === 'reprodutivo');
    const pregnancyDiagnosis = reproductiveAppointments.filter(a => 
      a.subtype === 'diagnostico_gestacao' && 
      a.reproductive_data?.pregnancy_result === 'positivo'
    );
    
    // Calculate calving interval if there are multiple births
    const offspring = allAnimals.filter(a => compareIds(a?.mother_id, currentAnimalId));
    let calvingInterval = null;
    if (offspring.length >= 2) {
      const birthDates = offspring
        .filter(o => o.birth_date)
        .map(o => new Date(o.birth_date))
        .sort((a, b) => a - b);
      
      if (birthDates.length >= 2) {
        const intervals = [];
        for (let i = 1; i < birthDates.length; i++) {
          intervals.push(differenceInDays(birthDates[i], birthDates[i-1]));
        }
        calvingInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      }
    }
    
    // Pregnancy rate
    const totalInseminations = reproductiveAppointments.filter(a => 
      a.subtype === 'ia' || a.subtype === 'iatf'
    ).length;
    const pregnancyRate = totalInseminations > 0 
      ? Math.round((pregnancyDiagnosis.length / totalInseminations) * 100)
      : null;
    
    reproductiveIndicators = {
      calvingInterval,
      pregnancyRate,
      totalOffspring: offspring.length,
      totalInseminations
    };
  }
  
  // Health alerts
  const recentAppointments = animalAppointments.filter(a => {
    const date = new Date(a.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= thirtyDaysAgo;
  });
  
  const hasExcessiveAppointments = recentAppointments.length >= 3;
  const hasRecurrentIssues = animalAppointments.filter(a => 
    a.type === 'clinico' || a.type === 'sanitario'
  ).length >= 5;
  
  const indicators = [
    {
      label: 'Total de Atendimentos',
      value: totalAppointments,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Custo Veterinário Total',
      value: `R$ ${totalVetCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
  ];
  
  if (reproductiveIndicators) {
    if (reproductiveIndicators.calvingInterval) {
      indicators.push({
        label: 'Intervalo entre Partos',
        value: `${reproductiveIndicators.calvingInterval} dias`,
        icon: Calendar,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50'
      });
    }
    if (reproductiveIndicators.pregnancyRate !== null) {
      indicators.push({
        label: 'Taxa de Prenhez',
        value: `${reproductiveIndicators.pregnancyRate}%`,
        icon: Heart,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50'
      });
    }
    indicators.push({
      label: 'Total de Crias',
      value: reproductiveIndicators.totalOffspring,
      icon: TrendingUp,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50'
    });
  }
  
  return (
    <div className="space-y-4">
      {/* Alerts */}
      {(hasExcessiveAppointments || hasRecurrentIssues) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Atenção</p>
                <ul className="text-sm text-amber-700 mt-1 space-y-1">
                  {hasExcessiveAppointments && (
                    <li>• {recentAppointments.length} atendimentos nos últimos 30 dias</li>
                  )}
                  {hasRecurrentIssues && (
                    <li>• Histórico elevado de problemas clínicos/sanitários</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 auto-rows-fr">
        {indicators.map((indicator, index) => {
          const Icon = indicator.icon;
          return (
            <Card key={index} className="border-0 shadow-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg sm:rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 ${indicator.bgColor} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${indicator.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide line-clamp-2">{indicator.label}</p>
                    <p className="text-sm sm:text-lg font-bold text-[var(--text-primary)] break-words line-clamp-2">{indicator.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
