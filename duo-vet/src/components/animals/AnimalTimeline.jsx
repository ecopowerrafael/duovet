import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Badge } from "../ui/badge";
import {
  Stethoscope,
  Syringe,
  Heart,
  Scissors,
  Scale,
  Shield,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const EVENT_TYPES = {
  clinico: { icon: Stethoscope, label: 'Clínico', color: 'bg-blue-500', lightColor: 'bg-blue-100 text-blue-700' },
  reprodutivo: { icon: Heart, label: 'Reprodutivo', color: 'bg-pink-500', lightColor: 'bg-pink-100 text-pink-700' },
  cirurgico: { icon: Scissors, label: 'Cirúrgico', color: 'bg-red-500', lightColor: 'bg-red-100 text-red-700' },
  sanitario: { icon: Shield, label: 'Sanitário', color: 'bg-green-500', lightColor: 'bg-green-100 text-green-700' },
  preventivo: { icon: Syringe, label: 'Preventivo', color: 'bg-purple-500', lightColor: 'bg-purple-100 text-purple-700' },
  pesagem: { icon: Scale, label: 'Pesagem', color: 'bg-amber-500', lightColor: 'bg-amber-100 text-amber-700' },
};

export default function AnimalTimeline({ appointments = [], weightRecords = [] }) {
  // Combine appointments and weight records into timeline events
  const timelineEvents = [
    ...appointments.map(a => ({
      id: a.id,
      type: a.type,
      date: new Date(a.date),
      title: EVENT_TYPES[a.type]?.label || a.type,
      subtitle: a.subtype || a.diagnosis || '',
      status: a.status,
      linkTo: createPageUrl('AppointmentDetail') + `?id=${a.id}`,
      data: a
    })),
    ...weightRecords.map(w => ({
      id: w.id,
      type: 'pesagem',
      date: new Date(w.date),
      title: 'Pesagem',
      subtitle: `${w.weight} kg`,
      data: w
    }))
  ].sort((a, b) => b.date - a.date);

  if (timelineEvents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <p className="text-[var(--text-secondary)] font-medium">Nenhum evento registrado</p>
        <p className="text-[var(--text-muted)] text-sm mt-1">O histórico do animal aparecerá aqui</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-[var(--border-color)]" />
      
      <div className="space-y-4">
        {timelineEvents.map((event, index) => {
          const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.clinico;
          const Icon = eventConfig.icon;
          
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {event.linkTo ? (
                <Link 
                  to={event.linkTo}
                  className="flex items-start gap-4 group"
                >
                  <TimelineItem event={event} eventConfig={eventConfig} Icon={Icon} />
                </Link>
              ) : (
                <div className="flex items-start gap-4">
                  <TimelineItem event={event} eventConfig={eventConfig} Icon={Icon} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineItem({ event, eventConfig, Icon }) {
  return (
    <>
      {/* Icon */}
      <div className={`relative z-10 w-12 h-12 ${eventConfig.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      
      {/* Content */}
      <div className="flex-1 bg-[var(--bg-tertiary)] rounded-xl p-4 group-hover:bg-[var(--accent)]/10 transition-colors border border-[var(--border-color)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={eventConfig.lightColor}>
                {event.title}
              </Badge>
              {event.status && (
                <Badge variant="outline" className="text-xs">
                  {event.status === 'finalizado' ? 'Finalizado' : 
                   event.status === 'em_andamento' ? 'Em andamento' : 'Faturado'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {format(event.date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            {event.subtitle && (
              <p className="text-sm text-[var(--text-muted)] mt-1">{event.subtitle}</p>
            )}
          </div>
          {event.linkTo && (
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
          )}
        </div>
      </div>
    </>
  );
}