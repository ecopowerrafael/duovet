import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { StatusBadge, PriorityBadge } from './StatusBadge';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function formatRelative(value) {
  if (!value) return 'agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'agora';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export default function TicketList({ tickets, selectedTicketId, onSelectTicket }) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return (
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
        <CardContent className="py-12 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">Nenhum ticket encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => {
        const active = ticket.id === selectedTicketId;
        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelectTicket(ticket)}
            className={`w-full text-left rounded-2xl border p-4 transition-colors ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">{ticket.ticket_code || `#${ticket.id}`}</p>
                <h3 className="font-semibold text-[var(--text-primary)]">{ticket.subject}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>

            <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">{ticket.description}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span>{ticket.category}</span>
              <span>•</span>
              <span>{formatDate(ticket.created_at)}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelative(ticket.updated_at)}
              </span>
            </div>
          </button>
        );
      })}
      {tickets.length > 6 ? (
        <Button variant="ghost" className="w-full text-[var(--text-muted)]">
          {tickets.length} tickets carregados
        </Button>
      ) : null}
    </div>
  );
}
