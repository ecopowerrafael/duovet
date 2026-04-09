import React from 'react';
import { Cloud, CloudOff, User, MapPin, ExternalLink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const EVENT_TYPES = {
  atendimento: { label: 'Atendimento', icon: 'Stethoscope', color: 'bg-[#22c55e]', darkColor: 'dark:bg-[#22c55e]/30' },
  preventivo: { label: 'Preventivo', icon: 'Shield', color: 'bg-blue-500', darkColor: 'dark:bg-blue-500/30' },
  consultoria: { label: 'Consultoria', icon: 'Briefcase', color: 'bg-purple-500', darkColor: 'dark:bg-purple-500/30' },
  retorno: { label: 'Retorno', icon: 'RefreshCw', color: 'bg-amber-500', darkColor: 'dark:bg-amber-500/30' },
  pessoal: { label: 'Pessoal', icon: 'User', color: 'bg-gray-500', darkColor: 'dark:bg-gray-500/30' },
  bloqueio: { label: 'Bloqueio', icon: 'Lock', color: 'bg-red-500', darkColor: 'dark:bg-red-500/30' }
};

const STATUS_CONFIG = {
  agendado: { label: 'Agendado', bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-500/20', darkText: 'dark:text-blue-300' },
  confirmado: { label: 'Confirmado', bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-500/20', darkText: 'dark:text-green-300' },
  em_atendimento: { label: 'Em Atend.', bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'dark:bg-amber-500/20', darkText: 'dark:text-amber-300' },
  finalizado: { label: 'Finalizado', bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-gray-500/20', darkText: 'dark:text-gray-300' },
  cancelado: { label: 'Cancelado', bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-500/20', darkText: 'dark:text-red-300' }
};

export default function EventCard({ event, client, property, onEdit, onSync, syncPending, isCompact = false }) {
  const navigate = useNavigate();
  const typeConfig = EVENT_TYPES[event.event_type] || EVENT_TYPES.atendimento;
  const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.agendado;
  const startTime = format(parseISO(event.start_datetime), 'HH:mm');

  const handleGoToAppointment = (e) => {
    e.stopPropagation();
    navigate(`/AppointmentDetail?id=${event.appointment_id}`);
  };

  if (isCompact) {
    return (
      <motion.button
        onClick={() => onEdit(event)}
        whileHover={{ scale: 1.02 }}
        className={`w-full text-left p-2.5 rounded-lg border-l-4 transition-all hover:shadow-md ${
          typeConfig.color
        } bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-bold text-[var(--text-secondary)]">{startTime}</div>
              <div className={`w-2 h-2 rounded-full ${
                event.status === 'finalizado' ? 'bg-gray-400' :
                event.status === 'cancelado' ? 'bg-red-500' :
                event.status === 'em_atendimento' ? 'bg-amber-500' :
                event.status === 'confirmado' ? 'bg-green-500' :
                'bg-blue-500'
              }`} title={statusConfig.label} />
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{event.title}</div>
            {client && <div className="text-xs text-[var(--text-muted)] truncate">{client.name}</div>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {event.is_synced && <Cloud className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />}
            {event.appointment_id && (
              <button
                onClick={handleGoToAppointment}
                className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-[#22c55e]"
                title="Ver atendimento original"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${typeConfig.color} bg-opacity-10 dark:bg-opacity-20 border-l-4 ${typeConfig.color} p-3.5 rounded-lg hover:shadow-md transition-all relative group`}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onEdit(event)}>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{startTime}</span>
          {event.is_synced && (
            <Cloud className="w-3.5 h-3.5 text-green-600 dark:text-green-400" title="Sincronizado com Google Calendar" />
          )}
          {event.appointment_id && (
            <button
              onClick={handleGoToAppointment}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-[#22c55e]"
              title="Ver atendimento original"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusConfig.bg} ${statusConfig.text} dark:${statusConfig.darkBg} dark:${statusConfig.darkText} text-xs font-semibold`}>
            {statusConfig.label}
          </Badge>
          {!event.is_readonly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync(event.id, event.is_synced);
              }}
              disabled={syncPending}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
              title={event.is_synced ? 'Remover sincronização' : 'Sincronizar com Google'}
            >
              {event.is_synced ? (
                <CloudOff className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>
      <div onClick={() => onEdit(event)} className="cursor-pointer">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">{event.title}</h4>
        {client && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{client.name}</span>
          </div>
        )}
        {property && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{property.name}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
