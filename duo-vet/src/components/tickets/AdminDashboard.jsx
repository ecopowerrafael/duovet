import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle2, Clock3, UserCheck } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './StatusBadge';

function relative(value) {
  if (!value) return 'agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'agora';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export default function AdminDashboard({
  tickets,
  onChangePriority,
  onAssignToMe,
  onCloseTicket
}) {
  const metrics = useMemo(() => {
    const all = Array.isArray(tickets) ? tickets : [];
    const open = all.filter((ticket) => ticket.status === 'open').length;
    const waitingUser = all.filter((ticket) => ticket.status === 'waiting_user').length;
    const urgent = all.filter((ticket) => ticket.priority === 'urgent' || ticket.priority === 'high').length;
    const closed = all.filter((ticket) => ticket.status === 'closed').length;
    return { open, waitingUser, urgent, closed };
  }, [tickets]);

  const queueByWait = useMemo(() => {
    const all = Array.isArray(tickets) ? tickets : [];
    return [...all]
      .filter((ticket) => ticket.status !== 'closed')
      .sort((a, b) => {
        const aTime = new Date(a.last_user_message_at || a.created_at).getTime();
        const bTime = new Date(b.last_user_message_at || b.created_at).getTime();
        return aTime - bTime;
      });
  }, [tickets]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--text-muted)]">Pendentes</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{metrics.open}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--text-muted)]">Aguardando Usuário</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{metrics.waitingUser}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--text-muted)]">Alta/Urgente</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{metrics.urgent}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--text-muted)]">Encerrados</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{metrics.closed}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[var(--text-primary)]">Fila por Tempo de Espera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queueByWait.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--text-secondary)]">Nenhum ticket pendente.</div>
          ) : queueByWait.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-[var(--border-color)] p-3 bg-[var(--bg-tertiary)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{ticket.ticket_code || `#${ticket.id}`}</p>
                  <p className="font-semibold text-[var(--text-primary)]">{ticket.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {relative(ticket.last_user_message_at || ticket.created_at)}</span>
                <span className="inline-flex items-center gap-1"><UserCheck className="w-3 h-3" /> {ticket.assigned_admin_name || 'Sem responsável'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => onChangePriority(ticket.id, 'high')}>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Mudar Prioridade
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => onAssignToMe(ticket.id)}>
                  <UserCheck className="w-3 h-3 mr-1" />
                  Atribuir a Mim
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => onCloseTicket(ticket.id)}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Encerrar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
