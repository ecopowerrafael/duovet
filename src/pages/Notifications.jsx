import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  Pill,
  Zap,
  CheckCheck,
  Trash2,
  Bell,
  ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

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
  alta: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300' },
  media: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300' },
  baixa: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300' }
};

export default function Notifications() {
  const [filterType, setFilterType] = useState('todos');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => Promise.resolve({ email: 'demo@duovet.com' }) // mock user
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => Promise.resolve([]),
    enabled: !!user?.email,
    refetchInterval: 30000
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) =>
      Promise.resolve(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
      toast.success('Notificação marcada como lida');
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (notificationId) =>
      Promise.resolve(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
      toast.success('Notificação removida');
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifs = notifications.filter(n => n.status === 'nao_lida');
      const updates = unreadNotifs.map(n =>
        Promise.resolve(n.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
      toast.success('Todas as notificações foram marcadas como lidas');
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
      window.location.href = notification.action_url;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--bg-card)] border-b-2 border-[var(--border-color)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">Notificações</h1>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white border-0 shadow-sm px-2 py-0.5">
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="hidden md:flex gap-2 rounded-xl text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'nao_lidas', label: 'Não lidas' },
            { id: 'lidas', label: 'Lidas' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {/* Mobile Mark All Read */}
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="md:hidden w-full mb-4 gap-2 rounded-xl text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </Button>
        )}

        {/* Empty State */}
        {filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <div className="w-20 h-20 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-[var(--accent)] opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {filterType === 'nao_lidas' ? 'Nenhuma notificação não lida' : 'Você não possui notificações no momento'}
            </h3>
            <p className="text-[var(--text-secondary)] max-w-md">
              {filterType === 'nao_lidas' 
                ? 'Você está em dia com suas notificações!'
                : 'Quando houver atualizações importantes, elas aparecerão aqui.'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification, index) => {
              const IconComponent = NOTIFICATION_ICONS[notification.type] || AlertCircle;
              const priorityStyle = PRIORITY_COLORS[notification.priority || 'media'];

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`p-4 cursor-pointer border-2 transition-all shadow-md hover:shadow-xl active:scale-[0.98] ${
                      notification.status === 'nao_lida'
                        ? `${priorityStyle.border} bg-[var(--accent)]/5`
                        : 'border-[var(--border-color)] bg-[var(--bg-card)]'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${priorityStyle.bg}`}>
                        <IconComponent className={`w-6 h-6 ${priorityStyle.text}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-base text-[var(--text-primary)] leading-tight">
                            {notification.title}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissMutation.mutate(notification.id);
                            }}
                            className="flex-shrink-0 text-[var(--text-muted)] hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">
                          {notification.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-muted)] font-medium">
                              {format(new Date(notification.created_date), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {notification.priority === 'alta' && (
                              <Badge className={`${priorityStyle.bg} ${priorityStyle.text} border-0 text-xs`}>
                                Urgente
                              </Badge>
                            )}
                          </div>
                          {notification.status === 'nao_lida' && (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                              <span className="text-xs font-semibold text-[var(--accent)]">Nova</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}