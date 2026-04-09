import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { base44 } from '../../api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../components/ui/alert-dialog';
import { Calendar, AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { Link } from 'react-router-dom';
import { format, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../lib/AuthContextJWT';
import { toast } from 'sonner';
import { offlineFetch, enqueueMutation, formatSyncErrorForUser, getPendingMutations } from '../../lib/offline';
import { deepClean } from '../../lib/utils';
import { normalizeAppointmentForAnalysis } from '../../lib/appointments';

export default function ReturnAlertsCard() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { data: fallbackUser } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    },
    enabled: !authUser?.email
  });

  const userEmail = authUser?.email || fallbackUser?.email || '';
  const isAdminUser = userEmail === 'admin@duovet.app';
  const [processingReturnId, setProcessingReturnId] = React.useState(null);
  const [confirmReturnAppointment, setConfirmReturnAppointment] = React.useState(null);

  const pendingMutations = getPendingMutations();
  const pendingAppointments = pendingMutations
    .filter((item) => item?.method === 'POST' && String(item?.url || '').includes('/api/appointments'))
    .map((item) => normalizeAppointmentForAnalysis({
      ...item?.body,
      id: item?.id,
      isPending: true
    }))
    .filter(Boolean);

  const isReturnDone = (appointment) => {
    const returnStatus = String(appointment?.return_status || '').toLowerCase();
    return appointment?.return_completed === true || ['concluido', 'realizado', 'cancelado'].includes(returnStatus);
  };

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments-with-return', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/appointments${query}`);
      const serverAppointments = (Array.isArray(res) ? res : [])
        .map(normalizeAppointmentForAnalysis)
        .filter(Boolean);

      const allAppointments = [...pendingAppointments, ...serverAppointments];

      return allAppointments.filter(a => 
        (a.needs_return === true || String(a.needs_return).toLowerCase() === 'true' || Number(a.needs_return) === 1) &&
        !!a.return_date &&
        !isReturnDone(a)
      );
    },
    enabled: !!userEmail
  });

  const markReturnDoneMutation = useMutation({
    mutationFn: async (appointmentToUpdate) => {
      if (!appointmentToUpdate?.id) {
        throw new Error('Atendimento inválido para atualizar retorno');
      }

      const payload = {
        ...appointmentToUpdate,
        return_status: 'realizado'
      };

      delete payload.id;
      delete payload._id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.client;
      delete payload.property;
      delete payload.animals;
      delete payload.lot;
      delete payload.isPending;

      const cleanedPayload = deepClean(payload) || {};
      return enqueueMutation(`/api/appointments/${appointmentToUpdate.id}`, {
        method: 'PUT',
        body: cleanedPayload
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments-with-return'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(res?.queued ? 'Retorno marcado e enfileirado para sincronização' : 'Retorno marcado como realizado');
    },
    onError: (error) => {
      toast.error(formatSyncErrorForUser(error));
    },
    onSettled: () => {
      setProcessingReturnId(null);
      setConfirmReturnAppointment(null);
    }
  });

  const handleOpenReturnDialog = (event, appointmentToUpdate) => {
    event.preventDefault();
    event.stopPropagation();

    if (!appointmentToUpdate?.id || markReturnDoneMutation.isPending) return;
    setConfirmReturnAppointment(appointmentToUpdate);
  };

  const handleConfirmReturnDone = () => {
    if (!confirmReturnAppointment?.id || markReturnDoneMutation.isPending) return;
    setProcessingReturnId(confirmReturnAppointment.id);
    markReturnDoneMutation.mutate(confirmReturnAppointment);
  };

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/clients${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const getClient = (clientId) => clients.find(c => c.id === clientId);

  const todayReturns = appointments.filter(a => isToday(new Date(a.return_date)));
  const overdueReturns = appointments.filter(a => isPast(new Date(a.return_date)) && !isToday(new Date(a.return_date)));
  const upcomingReturns = appointments.filter(a => !isPast(new Date(a.return_date)) && !isToday(new Date(a.return_date)));

  const sortedReturns = [
    ...overdueReturns.sort((a, b) => new Date(a.return_date).getTime() - new Date(b.return_date).getTime()),
    ...todayReturns.sort((a, b) => (a.return_time || '').localeCompare(b.return_time || '')),
    ...upcomingReturns.sort((a, b) => new Date(a.return_date).getTime() - new Date(b.return_date).getTime()),
  ].slice(0, 5);

  if (isLoading) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
            Retornos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--text-secondary)] text-center py-4">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
            Retornos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)]">Nenhum retorno pendente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
            Retornos Pendentes
          </CardTitle>
          <Badge className="w-fit bg-[var(--accent)] text-white">
            {appointments.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {overdueReturns.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-red-600">{overdueReturns.length}</div>
              <div className="text-xs text-red-600">Atrasados</div>
            </div>
          )}
          {todayReturns.length > 0 && (
            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{todayReturns.length}</div>
              <div className="text-xs text-[var(--accent)]">Hoje</div>
            </div>
          )}
          {upcomingReturns.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
              <div className="text-2xl font-bold text-blue-600">{upcomingReturns.length}</div>
              <div className="text-xs text-blue-600">Próximos</div>
            </div>
          )}
        </div>

        {/* Returns List */}
        <div className="space-y-2">
          {sortedReturns.map((appointment) => {
            const client = getClient(appointment.client_id);
            const returnDate = new Date(appointment.return_date);
            const isOverdue = isPast(returnDate) && !isToday(returnDate);
            const isReturnToday = isToday(returnDate);

            return (
              <Link
                key={appointment.id}
                to={createPageUrl('AppointmentDetail') + `?id=${appointment.id}`}
                className={`block p-3 rounded-lg border transition-all hover:shadow-md ${
                  isOverdue 
                    ? 'bg-red-500/5 border-red-500/30 hover:border-red-500'
                    : isReturnToday
                    ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30 hover:border-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isOverdue ? (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : isReturnToday ? (
                        <Clock className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                      ) : (
                        <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {client?.name || 'Cliente não identificado'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {appointment.return_type}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`text-xs font-medium ${
                        isOverdue ? 'text-red-600' : isReturnToday ? 'text-[var(--accent)]' : 'text-blue-600'
                      }`}>
                        {format(returnDate, "dd 'de' MMM", { locale: ptBR })}
                        {appointment.return_time && ` às ${appointment.return_time}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-[var(--border-color)]"
                      onClick={(event) => handleOpenReturnDialog(event, appointment)}
                      disabled={markReturnDoneMutation.isPending && String(processingReturnId) === String(appointment.id)}
                    >
                      {markReturnDoneMutation.isPending && String(processingReturnId) === String(appointment.id)
                        ? 'Salvando...'
                        : 'Retorno realizado'}
                    </Button>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {appointments.length > 5 && (
          <Button 
            variant="outline" 
            className="w-full mt-4 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
            onClick={() => window.location.href = createPageUrl('Appointments')}
          >
            Ver todos os {appointments.length} retornos
          </Button>
        )}

        <AlertDialog
          open={!!confirmReturnAppointment}
          onOpenChange={(open) => {
            if (!open) setConfirmReturnAppointment(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar retorno realizado?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação remove o retorno da lista de pendentes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={markReturnDoneMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReturnDone}
                disabled={markReturnDoneMutation.isPending}
              >
                {markReturnDoneMutation.isPending ? 'Salvando...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
