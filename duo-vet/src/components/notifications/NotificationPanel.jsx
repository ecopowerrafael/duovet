import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  DollarSign,
  Pill,
  Zap,
  X,
  CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NOTIFICATION_ICONS = {
  agenda_hoje: Calendar,
  agenda_proximas_24h: Calendar,
  agenda_atrasado: AlertCircle,
  retorno_agendado: Calendar,
  atendimento_com_retorno: AlertCircle,
  atendimento_sem_relatorio: FileText,
  atendimento_sem_prescricao: Pill,
  consultoria_proxima: Calendar,
  consultoria_sem_registro: AlertCircle,
  consultoria_sem_relatorio: FileText,
  reprodutivo_retorno: Zap,
  pagamento_pendente: DollarSign,
  consultoria_nao_faturada: DollarSign,
  outro: AlertCircle
};

const PRIORITY_COLORS = {
  alta: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  media: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  baixa: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' }
};

export default function NotificationPanel({ isOpen, onClose }) {
  const [filterType, setFilterType] = useState('todos');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const notifs = await base44.entities.Notification.filter(
        { created_by: user.email },
        '-created_date',
        100
      );
      return notifs;
    },
    enabled: !!user?.email,
    refetchInterval: 30000
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) =>
      base44.entities.Notification.update(notificationId, {
        status: 'lida',
        read_at: new Date().toISOString()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (notificationId) =>
      base44.entities.Notification.update(notificationId, {
        is_dismissed: true
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifs = notifications.filter(n => n.status === 'nao_lida');
      const updates = unreadNotifs.map(n =>
        base44.entities.Notification.update(n.id, {
          status: 'lida',
          read_at: new Date().toISOString()
        })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    }
  });

  const filteredNotifications = notifications.filter(n => {
    if (n.is_dismissed) return false;
    if (filterType === 'nao_lidas') return n.status === 'nao_lida';
    if (filterType === 'lidas') return n.status === 'lida';
    return true;
  });

  const unreadCount = notifications.filter(n => n.status === 'nao_lida' && !n.is_dismissed).length;

  const handleNotificationClick = (notification) => {
    // Marcar como lida
    if (notification.status === 'nao_lida') {
      markAsReadMutation.mutate(notification.id);
    }

    // Navegar para página relacionada
    if (notification.action_url) {
      onClose();
      window.location.href = notification.action_url;
    }
  };

  return (
    <div className="w-full h-full md:w-96 md:max-w-md md:h-screen flex flex-col bg-[var(--bg-primary)] md:bg-[var(--bg-secondary)] md:border-l-2 border-[var(--border-color)] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 md:p-5 border-b-2 border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">Notificações</h2>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 shadow-sm">{unreadCount}</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex-shrink-0 flex gap-2 px-4 pt-3 border-b-2 border-[var(--border-color)] pb-3 bg-[var(--bg-card)] shadow-sm">
        {[
          { id: 'todos', label: 'Todas' },
          { id: 'nao_lidas', label: 'Não lidas' },
          { id: 'lidas', label: 'Lidas' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              filterType === tab.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Bar */}
      {unreadCount > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b-2 border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            className="text-xs gap-2 text-[var(--accent)]"
          >
            <CheckCheck className="w-3 h-3" />
            Marcar tudo como lido
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] md:bg-[var(--bg-secondary)]">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <CheckCircle2 className="w-10 h-10 text-[var(--accent)] opacity-50" />
            <p className="text-[var(--text-secondary)] text-sm">
              {unreadCount === 0 ? 'Sem notificações' : 'Nenhuma notificação não lida'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {filteredNotifications.map(notification => {
              const IconComponent = NOTIFICATION_ICONS[notification.type] || AlertCircle;
              const priorityStyle = PRIORITY_COLORS[notification.priority || 'media'];

              return (
                <Card
                  key={notification.id}
                  className={`mx-3 my-2 p-4 cursor-pointer border-2 transition-all shadow-md ${
                    notification.status === 'nao_lida'
                      ? 'border-[var(--accent)]/50 bg-[var(--bg-card)] shadow-[var(--accent)]/10'
                      : 'border-[var(--border-color)] bg-[var(--bg-card)]'
                  } hover:border-[var(--accent)]/70 hover:shadow-xl active:scale-[0.98]`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${priorityStyle.bg}`}>
                      <IconComponent className={`w-5 h-5 ${priorityStyle.text}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[var(--text-primary)] leading-tight">
                          {notification.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissMutation.mutate(notification.id);
                          }}
                          className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {notification.description}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {format(new Date(notification.created_date), 'HH:mm', { locale: ptBR })}
                        </span>
                        {notification.status === 'nao_lida' && (
                          <div className="w-2 h-2 bg-[var(--accent)] rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}