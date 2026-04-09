import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Activity,
  Heart,
  Shield,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { includesAnimalInAppointment, normalizeAppointmentForAnalysis } from '../../lib/appointments';

export default function AIAlerts({ animals = [], appointments = [] }) {
  const alerts = [];
  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  
  // Check each animal for potential issues
  animals.forEach(animal => {
    const animalId = animal?.id || animal?._id;
    const animalAppointments = normalizedAppointments.filter((appointmentItem) => includesAnimalInAppointment(appointmentItem, animalId));
    
    // Recent appointments (last 30 days)
    const recentAppointments = animalAppointments.filter(a => {
      const date = new Date(a.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    });
    
    // Alert: Excessive appointments
    if (recentAppointments.length >= 3) {
      alerts.push({
        id: `excessive-${animal.id}`,
        type: 'warning',
        icon: Activity,
        title: 'Excesso de Atendimentos',
        description: `${animal.name} teve ${recentAppointments.length} atendimentos nos últimos 30 dias`,
        animalId,
        priority: 2
      });
    }
    
    // Alert: Recurrent health issues
    const clinicalAppointments = animalAppointments.filter(a => a.type === 'clinico');
    const uniqueDiagnoses = [...new Set(clinicalAppointments.map(a => a.diagnosis).filter(Boolean))];
    const repeatedDiagnoses = uniqueDiagnoses.filter(d => 
      clinicalAppointments.filter(a => a.diagnosis === d).length >= 2
    );
    
    if (repeatedDiagnoses.length > 0) {
      alerts.push({
        id: `recurrent-${animal.id}`,
        type: 'warning',
        icon: Shield,
        title: 'Problema Recorrente',
        description: `${animal.name} tem histórico repetido de: ${repeatedDiagnoses[0]}`,
        animalId,
        priority: 1
      });
    }
    
    // Alert: Reproductive performance (for females)
    if (animal.sex === 'femea') {
      const reproductiveAppointments = animalAppointments.filter(a => a.type === 'reprodutivo');
      const inseminations = reproductiveAppointments.filter(a => 
        a.subtype === 'ia' || a.subtype === 'iatf'
      ).length;
      const pregnancies = reproductiveAppointments.filter(a =>
        a.subtype === 'diagnostico_gestacao' && 
        a.reproductive_data?.pregnancy_result === 'positivo'
      ).length;
      
      if (inseminations >= 3 && pregnancies === 0) {
        alerts.push({
          id: `repro-${animal.id}`,
          type: 'critical',
          icon: Heart,
          title: 'Baixo Desempenho Reprodutivo',
          description: `${animal.name} teve ${inseminations} inseminações sem prenhez confirmada`,
          animalId,
          priority: 0
        });
      }
    }
  });
  
  // Sort by priority
  alerts.sort((a, b) => a.priority - b.priority);
  
  if (alerts.length === 0) {
    return null;
  }
  
  return (
    <Card className="border-0 shadow-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-[var(--border-color)]">
        <CardTitle className="text-lg font-semibold flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 rounded-xl">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          Alertas Inteligentes
          <Badge className="bg-amber-500/20 text-amber-500 border-0 ml-auto">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => {
            const Icon = alert.icon;
            const typeColors = {
              critical: 'border-red-500/30 bg-red-500/10',
              warning: 'border-amber-500/30 bg-amber-500/10',
              info: 'border-blue-500/30 bg-blue-500/10'
            };
            const iconColors = {
              critical: 'bg-red-500 text-white',
              warning: 'bg-amber-500 text-white',
              info: 'bg-blue-500 text-white'
            };
            
            return (
              <Link
                key={alert.id}
                to={createPageUrl('AnimalDetail') + `?id=${alert.animalId}`}
                className={`flex items-center gap-4 p-4 rounded-xl border ${typeColors[alert.type]} hover:opacity-80 transition-opacity group`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColors[alert.type]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm">{alert.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{alert.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
