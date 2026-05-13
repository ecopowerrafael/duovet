import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { ArrowLeft, Bell, Clock, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { offlineFetch, enqueueMutation } from '../lib/offline';

const NOTIFICATION_TYPES = [
  { id: 'agenda_hoje', label: 'Atendimento agendado para hoje', category: 'Agenda' },
  { id: 'agenda_proximas_24h', label: 'Atendimento nas próximas 24h', category: 'Agenda' },
  { id: 'agenda_atrasado', label: 'Atendimento atrasado', category: 'Agenda' },
  { id: 'retorno_agendado', label: 'Retorno agendado', category: 'Agenda' },
  { id: 'atendimento_com_retorno', label: 'Atendimento com retorno pendente', category: 'Atendimentos' },
  { id: 'atendimento_sem_relatorio', label: 'Atendimento sem relatório', category: 'Atendimentos' },
  { id: 'atendimento_sem_prescricao', label: 'Atendimento sem prescrição', category: 'Atendimentos' },
  { id: 'consultoria_proxima', label: 'Consultoria recorrente próxima', category: 'Consultorias' },
  { id: 'consultoria_sem_registro', label: 'Consultoria sem registro recente', category: 'Consultorias' },
  { id: 'consultoria_sem_relatorio', label: 'Relatório de consultoria pendente', category: 'Consultorias' },
  { id: 'reprodutivo_retorno', label: 'Reprodutivo com retorno programado', category: 'Reprodução' },
  { id: 'pagamento_pendente', label: 'Pagamento pendente', category: 'Financeiro' },
  { id: 'consultoria_nao_faturada', label: 'Consultoria não faturada', category: 'Financeiro' }
];

export default function NotificationSettings() {
  const [enabledNotifications, setEnabledNotifications] = useState({});
  const lastSettingsRef = React.useRef(enabledNotifications);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: vetProfile } = useQuery({
    queryKey: ['vetProfile'],
    queryFn: async () => {
      const profiles = await offlineFetch(`/api/vetprofiles?created_by=${user?.email}`);
      return profiles[0] || null;
    },
    enabled: !!user?.email
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!vetProfile?.id) return;
      return enqueueMutation(`/api/vetprofiles/${vetProfile.id}`, {
        method: 'PUT',
        body: { notification_settings: lastSettingsRef.current }
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['vetProfile'] });
      toast.success(res?.queued ? 'Configurações enfileiradas para sincronização' : 'Configurações salvas!');
    }
  });

  React.useEffect(() => {
    if (vetProfile?.notification_settings) {
      setEnabledNotifications(vetProfile.notification_settings);
      lastSettingsRef.current = vetProfile.notification_settings;
    } else {
      // Default: all enabled
      const defaults = {};
      NOTIFICATION_TYPES.forEach(type => {
        defaults[type.id] = true;
      });
      setEnabledNotifications(defaults);
      lastSettingsRef.current = defaults;
    }
  }, [vetProfile]);

  const handleToggle = (typeId) => {
    const newSettings = {
      ...enabledNotifications,
      [typeId]: !enabledNotifications[typeId]
    };
    setEnabledNotifications(newSettings);
    lastSettingsRef.current = newSettings;
    updateSettingsMutation.mutate();
  };

  const groupedNotifications = NOTIFICATION_TYPES.reduce((acc, notif) => {
    const category = notif.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(notif);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Configurações de Notificações</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Personalize quais notificações deseja receber</p>
        </div>
      </div>

      {/* Master Toggle */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-[var(--accent)]" />
            Sistema de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">Notificações do Sistema</p>
                <p className="text-sm text-[var(--text-secondary)]">Receber alertas e avisos importantes</p>
              </div>
            </div>
            <Switch defaultChecked className="bg-[var(--accent)]" />
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">Antecedência de Alertas</p>
                <p className="text-sm text-[var(--text-secondary)]">Receber notificações com 24h de antecedência</p>
              </div>
            </div>
            <Switch defaultChecked className="bg-[var(--accent)]" />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      {Object.entries(groupedNotifications).map(([category, types]) => (
        <Card key={category} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)]">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {types.map(notif => (
              <div
                key={notif.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Label className="flex-1 cursor-pointer font-medium text-sm text-[var(--text-primary)]">
                  {notif.label}
                </Label>
                <Switch
                  checked={enabledNotifications[notif.id] !== false}
                  onCheckedChange={() => handleToggle(notif.id)}
                  className="bg-[var(--accent)]"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Info Box */}
      <Card className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl">
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--text-primary)]">
            <strong>💡 Dica:</strong> As notificações são atualizadas a cada 30 minutos. Para receber alertas mais precisos sobre atendimentos de hoje, acesse a página de Agenda.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
