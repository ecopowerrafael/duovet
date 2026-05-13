import React from 'react';
import { Badge } from '../ui/badge';

const STATUS_MAP = {
  open: { label: 'Aberto', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  waiting_user: { label: 'Aguardando Usuário', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  closed: { label: 'Encerrado', className: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const PRIORITY_MAP = {
  low: { label: 'Baixa', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  normal: { label: 'Normal', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' }
};

export function StatusBadge({ status }) {
  const config = STATUS_MAP[String(status || '').toLowerCase()] || STATUS_MAP.open;
  return <Badge className={`border ${config.className}`}>{config.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const config = PRIORITY_MAP[String(priority || '').toLowerCase()] || PRIORITY_MAP.normal;
  return <Badge className={`border ${config.className}`}>{config.label}</Badge>;
}
