import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGlobalSettings, updateGlobalSettings, getUsers, deactivateUser, adminChangeUserPassword, sendNotification, broadcastNotification, activateUserSubscription } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { format, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, Send, Users, User } from 'lucide-react';
import { toast } from 'sonner';
import { clearQueuedMutationsByUrl, flushQueue, isOnline } from '../lib/offline';

const DEFAULT_REDIRECT_URI = 'https://duovet.app/api/auth/google/callback';
const DEFAULT_STRIPE_MONTHLY_PRODUCT_ID = 'prod_UAoJfiOqTgkAmg';
const DEFAULT_STRIPE_YEARLY_PRODUCT_ID = 'prod_UAoK3v1S7pxo1J';
const DEFAULT_EMAIL_TEMPLATES = {
  emailWelcomeEnabled: 'true',
  emailWelcomeSubject: 'Conta criada com sucesso - DuoVet',
  emailWelcomeBody: `<p>Olá {{veterinario_nome}},</p>
<p>Sua conta no DuoVet foi criada com sucesso.</p>
<p>Agora você já pode acessar a plataforma e iniciar a gestão dos seus atendimentos.</p>
<p><a href="{{login_url}}">{{login_url}}</a></p>
<p>Se você não reconhece este cadastro, entre em contato com o suporte.</p>`,
  emailResetPasswordEnabled: 'true',
  emailResetPasswordSubject: 'Recuperação de Senha - DuoVet',
  emailResetPasswordBody: `<p>Olá {{veterinario_nome}},</p>
<p>Você solicitou a recuperação de sua senha no DuoVet.</p>
<p>Clique no link abaixo para criar uma nova senha:</p>
<p><a href="{{reset_url}}">{{reset_url}}</a></p>
<p>Este link expira em 1 hora.</p>
<p>Se você não solicitou isso, ignore este e-mail.</p>`,
  emailConsultancyReminderEnabled: 'true',
  emailConsultancyReminderSubject: 'Lembrete de cobrança da consultoria - DuoVet',
  emailConsultancyReminderBody: `<p>Olá {{cliente_nome}},</p>
<p>Este é um lembrete de cobrança da sua consultoria técnica.</p>
<p><strong>Veterinário:</strong> {{veterinario_nome}}</p>
<p><strong>Propriedade:</strong> {{propriedade_nome}}</p>
<p><strong>Animal:</strong> {{animal_nome}}</p>
<p><strong>Vencimento:</strong> {{data_vencimento}}</p>
<p><strong>Valor:</strong> {{valor_cobranca}}</p>
<p>Em caso de dúvidas, responda este e-mail.</p>`
};
const EMAIL_SHORTCUTS = [
  { key: '{{veterinario_nome}}', description: 'Nome do veterinário responsável' },
  { key: '{{cliente_nome}}', description: 'Nome do cliente/produtor' },
  { key: '{{animal_nome}}', description: 'Nome do animal' },
  { key: '{{propriedade_nome}}', description: 'Nome da propriedade' },
  { key: '{{valor_cobranca}}', description: 'Valor da cobrança' },
  { key: '{{data_vencimento}}', description: 'Data de vencimento formatada' },
  { key: '{{reset_url}}', description: 'Link de redefinição de senha' },
  { key: '{{login_url}}', description: 'Link de login da plataforma' }
];

const safeFormatDate = (dateStr, formatStr = 'dd/MM/yyyy') => {
  try {
    if (!dateStr) return 'Data não informada';
    const date = new Date(dateStr);
    if (!isValid(date)) return 'Data inválida';
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return 'Erro na data';
  }
};

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    redirectUri: DEFAULT_REDIRECT_URI,
    googleClientId: '',
    googleClientSecret: '',
    facebookAppId: '',
    facebookAppSecret: '',
    stripePublicKey: '',
    stripeSecretKey: '',
    stripeMonthlyProductId: DEFAULT_STRIPE_MONTHLY_PRODUCT_ID,
    stripeYearlyProductId: DEFAULT_STRIPE_YEARLY_PRODUCT_ID,
    planAutonomoActive: 'true',
    planAutonomoMonthly: '89.90',
    planAutonomoYearly: '899.00',
    planProfissionalActive: 'true',
    planProfissionalMonthly: '287.68',
    planProfissionalYearly: '2876.80',
    planEmpresarialActive: 'true',
    planEmpresarialMonthly: '988.90',
    planEmpresarialYearly: '9889.00',
    supportWhatsapp: '',
    organizationName: '',
    cnpj: '',
    address: '',
    ...DEFAULT_EMAIL_TEMPLATES
  });
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Subscription activation states
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [selectedUserForSubscription, setSelectedUserForSubscription] = useState(null);
  const [subscriptionBillingPeriod, setSubscriptionBillingPeriod] = useState('monthly');
  const [subscriptionPlan, setSubscriptionPlan] = useState('profissional');

  // Notification states
  const [notificationForm, setNotificationForm] = useState({
    targetType: 'all', // 'all' or 'specific'
    userId: '',
    title: '',
    description: '',
    type: 'info'
  });
  const [notificationLoading, setNotificationLoading] = useState(false);

  useEffect(() => {
    getGlobalSettings()
      .then(setSettings)
      .catch(() => toast.error('Erro ao carregar configurações'));
    getUsers()
      .then(setUsers)
      .catch(() => toast.error('Erro ao carregar usuários'));
  }, []);

  useEffect(() => {
    setSettingsForm({
      redirectUri: settings?.redirectUri || DEFAULT_REDIRECT_URI,
      googleClientId: settings?.googleClientId || settings?.googleOAuthKey || '',
      googleClientSecret: settings?.googleClientSecret || '',
      facebookAppId: settings?.facebookAppId || settings?.facebookOAuthKey || '',
      facebookAppSecret: settings?.facebookAppSecret || '',
      stripePublicKey: settings?.stripePublicKey || '',
      stripeSecretKey: settings?.stripeSecretKey || '',
      stripeMonthlyProductId: settings?.stripeMonthlyProductId || DEFAULT_STRIPE_MONTHLY_PRODUCT_ID,
      stripeYearlyProductId: settings?.stripeYearlyProductId || DEFAULT_STRIPE_YEARLY_PRODUCT_ID,
      planAutonomoActive: settings?.planAutonomoActive || 'true',
      planAutonomoMonthly: settings?.planAutonomoMonthly || settings?.planMonthly || '89.90',
      planAutonomoYearly: settings?.planAutonomoYearly || settings?.planYearly || '899.00',
      planProfissionalActive: settings?.planProfissionalActive || 'true',
      planProfissionalMonthly: settings?.planProfissionalMonthly || (settings?.planMonthly ? String(Number(settings.planMonthly) * 3.2) : '287.68'),
      planProfissionalYearly: settings?.planProfissionalYearly || (settings?.planYearly ? String(Number(settings.planYearly) * 3.2) : '2876.80'),
      planEmpresarialActive: settings?.planEmpresarialActive || 'true',
      planEmpresarialMonthly: settings?.planEmpresarialMonthly || (settings?.planMonthly ? String(Number(settings.planMonthly) * 11) : '988.90'),
      planEmpresarialYearly: settings?.planEmpresarialYearly || (settings?.planYearly ? String(Number(settings.planYearly) * 11) : '9889.00'),
      supportWhatsapp: settings?.supportWhatsapp || '',
      organizationName: settings?.organizationName || '',
      cnpj: settings?.cnpj || '',
      address: settings?.address || '',
      emailWelcomeEnabled: settings?.emailWelcomeEnabled ?? DEFAULT_EMAIL_TEMPLATES.emailWelcomeEnabled,
      emailWelcomeSubject: settings?.emailWelcomeSubject ?? DEFAULT_EMAIL_TEMPLATES.emailWelcomeSubject,
      emailWelcomeBody: settings?.emailWelcomeBody ?? DEFAULT_EMAIL_TEMPLATES.emailWelcomeBody,
      emailResetPasswordEnabled: settings?.emailResetPasswordEnabled ?? DEFAULT_EMAIL_TEMPLATES.emailResetPasswordEnabled,
      emailResetPasswordSubject: settings?.emailResetPasswordSubject ?? DEFAULT_EMAIL_TEMPLATES.emailResetPasswordSubject,
      emailResetPasswordBody: settings?.emailResetPasswordBody ?? DEFAULT_EMAIL_TEMPLATES.emailResetPasswordBody,
      emailConsultancyReminderEnabled: settings?.emailConsultancyReminderEnabled ?? DEFAULT_EMAIL_TEMPLATES.emailConsultancyReminderEnabled,
      emailConsultancyReminderSubject: settings?.emailConsultancyReminderSubject ?? DEFAULT_EMAIL_TEMPLATES.emailConsultancyReminderSubject,
      emailConsultancyReminderBody: settings?.emailConsultancyReminderBody ?? DEFAULT_EMAIL_TEMPLATES.emailConsultancyReminderBody
    });
  }, [settings]);

  useEffect(() => {
    setFilteredUsers(
      (users || []).filter(u =>
        u && (
          u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
          u.name?.toLowerCase().includes(searchUser.toLowerCase())
        )
      )
    );
  }, [searchUser, users]);

  const handleSettingsChange = e => {
    setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });
  };
  const handleSettingsSave = async () => {
    setLoading(true);
    try {
      const removed = await clearQueuedMutationsByUrl('/api/settings');
      if (removed > 0) {
        toast.info(`${removed} sincronização(ões) antiga(s) de configurações foram limpas.`);
      }
      const payload = {
        ...settingsForm,
        redirectUri: DEFAULT_REDIRECT_URI
      };
      const updated = await updateGlobalSettings(payload);
      if (updated?.queued) {
        toast.warning('Sem conexão com o servidor. As alterações foram para a fila de sincronização.');
        return;
      }
      setSettings(updated);
      // Invalidar cache de configurações globais para forçar reload nos componentes que dependem delas
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      if (isOnline()) {
        await flushQueue({ force: true });
      }
      toast.success('Configurações salvas!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateUser = async id => {
    setLoading(true);
    try {
      await deactivateUser(id);
      setUsers((users || []).filter(u => u && String(u.id || '') !== String(id || '')));
      toast.success('Usuário desativado!');
    } catch (err) {
      toast.error('Erro ao desativar usuário');
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await adminChangeUserPassword(selectedUser.id, newPassword);
      toast.success(`Senha de ${selectedUser.name} alterada com sucesso!`);
      setIsDialogOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error('Erro ao alterar senha do usuário');
    }
    setLoading(false);
  };

  const handleActivateSubscription = async () => {
    if (!selectedUserForSubscription) {
      toast.error('Selecione um usuário');
      return;
    }
    if (!subscriptionBillingPeriod || !subscriptionPlan) {
      toast.error('Selecione o período e plano');
      return;
    }

    setLoading(true);
    try {
      await activateUserSubscription(selectedUserForSubscription.id, subscriptionBillingPeriod, subscriptionPlan);
      toast.success(`Assinatura de ${selectedUserForSubscription.name} ativada com sucesso!`);
      setIsSubscriptionDialogOpen(false);
      setSelectedUserForSubscription(null);
      
      // Reload users list
      const updatedUsers = await getUsers();
      setUsers(updatedUsers);
    } catch (err) {
      toast.error(err?.message || 'Erro ao ativar assinatura');
    }
    setLoading(false);
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notificationForm.title || !notificationForm.description) {
      toast.error('Título e descrição são obrigatórios');
      return;
    }

    if (notificationForm.targetType === 'specific' && !notificationForm.userId) {
      toast.error('Selecione um usuário para a notificação específica');
      return;
    }

    setNotificationLoading(true);
    try {
      if (notificationForm.targetType === 'all') {
        await broadcastNotification({
          title: notificationForm.title,
          description: notificationForm.description,
          type: notificationForm.type
        });
        toast.success('Notificação enviada para todos os usuários!');
      } else {
        const targetUser = (users || []).find(u => u && String(u.id || '') === String(notificationForm.userId || ''));
        if (!targetUser) {
          toast.error('Usuário não encontrado');
          setNotificationLoading(false);
          return;
        }
        await sendNotification({
          title: notificationForm.title,
          description: notificationForm.description,
          type: notificationForm.type,
          created_by: targetUser.email // Backend will use this to route to user
        });
        toast.success(`Notificação enviada para ${targetUser.name}!`);
      }
      
      // Reset form
      setNotificationForm({
        ...notificationForm,
        title: '',
        description: ''
      });
    } catch (err) {
      console.error('Error sending notification:', err);
      toast.error('Erro ao enviar notificação');
    }
    setNotificationLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <CardHeader>
          <CardTitle>
            <span className="text-2xl font-bold text-[var(--text-primary)]">Painel Admin</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login-social">
            <TabsList>
              <TabsTrigger value="login-social">Login Social</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
              <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
              <TabsTrigger value="email-templates">Templates de E-mail</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>
            <TabsContent value="login-social">
              <h2 className="text-lg font-semibold mb-4">Configuração de Login Social</h2>
              <div className="space-y-4">
                <Input name="redirectUri" value={DEFAULT_REDIRECT_URI} readOnly placeholder="Redirect URI" />
                <Input name="googleClientId" value={settingsForm.googleClientId || ''} onChange={handleSettingsChange} placeholder="Google Client ID" />
                <Input name="googleClientSecret" value={settingsForm.googleClientSecret || ''} onChange={handleSettingsChange} placeholder="Google Client Secret" />
                <Input name="facebookAppId" value={settingsForm.facebookAppId || ''} onChange={handleSettingsChange} placeholder="Facebook App ID" />
                <Input name="facebookAppSecret" value={settingsForm.facebookAppSecret || ''} onChange={handleSettingsChange} placeholder="Facebook App Secret" />
                <Button variant="default" onClick={handleSettingsSave} disabled={loading}>Salvar</Button>
              </div>
            </TabsContent>
            <TabsContent value="stripe">
              <h2 className="text-lg font-semibold mb-4">Stripe</h2>
              <div className="space-y-4">
                <Input name="stripePublicKey" value={settingsForm.stripePublicKey || ''} onChange={handleSettingsChange} placeholder="Chave Stripe Public" />
                <Input name="stripeSecretKey" value={settingsForm.stripeSecretKey || ''} onChange={handleSettingsChange} placeholder="Chave Stripe Secret" />
                <Input name="stripeMonthlyProductId" value={settingsForm.stripeMonthlyProductId || ''} onChange={handleSettingsChange} placeholder="Produto Mensal (prod_...)" />
                <Input name="stripeYearlyProductId" value={settingsForm.stripeYearlyProductId || ''} onChange={handleSettingsChange} placeholder="Produto Anual (prod_...)" />
                <Button variant="default" onClick={handleSettingsSave} disabled={loading}>Salvar</Button>
              </div>
            </TabsContent>
            <TabsContent value="subscriptions">
              <h2 className="text-lg font-semibold mb-4">Gestão de Assinaturas</h2>
              <div className="space-y-6">
                {[
                  { id: 'Autonomo', name: 'Autônomo' },
                  { id: 'Profissional', name: 'Profissional' },
                  { id: 'Empresarial', name: 'Empresarial' }
                ].map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={settingsForm[`plan${plan.id}Active`] === 'true'}
                          onChange={(e) => {
                            setSettingsForm({
                              ...settingsForm,
                              [`plan${plan.id}Active`]: e.target.checked ? 'true' : 'false'
                            });
                          }}
                        />
                        Ativo
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        name={`plan${plan.id}Monthly`}
                        value={settingsForm[`plan${plan.id}Monthly`] || ''}
                        onChange={handleSettingsChange}
                        placeholder="Valor Mensal"
                        type="number"
                      />
                      <Input
                        name={`plan${plan.id}Yearly`}
                        value={settingsForm[`plan${plan.id}Yearly`] || ''}
                        onChange={handleSettingsChange}
                        placeholder="Valor Anual"
                        type="number"
                      />
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">WhatsApp de suporte</h3>
                  <Input
                    name="supportWhatsapp"
                    value={settingsForm.supportWhatsapp || ''}
                    onChange={handleSettingsChange}
                    placeholder="Ex: 5511999999999"
                  />
                </div>

                <Button variant="default" onClick={handleSettingsSave} disabled={loading}>Salvar</Button>
              </div>
            </TabsContent>
            <TabsContent value="users">
              <h2 className="text-lg font-semibold mb-4">Gestão de Usuários</h2>
              <div className="space-y-4">
                <Input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Buscar usuário por nome ou email" />
                <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredUsers || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-[var(--text-muted)]">
                            Nenhum usuário encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (filteredUsers || []).map(u => {
                        if (!u) return null;
                        const createdAt = u.created_at ? new Date(u.created_at) : new Date();
                        const status = u.subscription_status || u.status;
                        const isTrial = status === 'trial' || status === 'expired';
                        
                        let expirationDate = null;
                        if (u.subscription_end) {
                          expirationDate = new Date(u.subscription_end);
                        } else if (isTrial) {
                          expirationDate = addDays(createdAt, 15);
                        }

                        const statusMap = {
                          'trial': 'Teste Grátis',
                          'active': 'Ativo',
                          'expired': 'Expirado',
                          'inactive': 'Inativo',
                          'canceled': 'Cancelado'
                        };

                        return (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div className="font-medium">{u.name}</div>
                              <div className="text-sm text-[var(--text-muted)]">{u.email}</div>
                            </TableCell>
                            <TableCell>
                              {safeFormatDate(u.created_at)}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                status === 'active' ? 'bg-green-100 text-green-700' :
                                status === 'trial' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {statusMap[status] || status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {expirationDate ? safeFormatDate(expirationDate) : '-'}
                            </TableCell>
                            <TableCell className="text-right flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setIsDialogOpen(true);
                                }}
                                disabled={loading}
                              >
                                Alterar Senha
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedUserForSubscription(u);
                                  setSubscriptionBillingPeriod('monthly');
                                  setSubscriptionPlan('profissional');
                                  setIsSubscriptionDialogOpen(true);
                                }}
                                disabled={loading}
                              >
                                Ativar Assinatura
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeactivateUser(u.id)} 
                                disabled={loading || u.status === 'inactive'}
                              >
                                {u.status === 'inactive' ? 'Desativado' : 'Desativar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="notifications">
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-4">
                  <Bell className="w-5 h-5 text-[var(--text-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Enviar Notificações Push</h2>
                </div>

                <form onSubmit={handleSendNotification} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Público Alvo</label>
                      <Select 
                        value={notificationForm.targetType} 
                        onValueChange={(val) => setNotificationForm({...notificationForm, targetType: val})}
                      >
                        <SelectTrigger className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                          <SelectValue placeholder="Selecione o público" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>Todos os Usuários</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="specific">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>Usuário Específico</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {notificationForm.targetType === 'specific' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text-primary)]">Selecionar Usuário</label>
                        <Select 
                          value={notificationForm.userId} 
                          onValueChange={(val) => setNotificationForm({...notificationForm, userId: val})}
                        >
                          <SelectTrigger className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                            <SelectValue placeholder="Buscar usuário..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(users || []).map(u => u && (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.name} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Tipo de Notificação</label>
                      <Select 
                        value={notificationForm.type} 
                        onValueChange={(val) => setNotificationForm({...notificationForm, type: val})}
                      >
                        <SelectTrigger className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Informativa</SelectItem>
                          <SelectItem value="alert">Alerta / Urgente</SelectItem>
                          <SelectItem value="success">Sucesso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Título</label>
                    <Input 
                      placeholder="Ex: Novo recurso disponível!" 
                      value={notificationForm.title}
                      onChange={(e) => setNotificationForm({...notificationForm, title: e.target.value})}
                      className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">Mensagem</label>
                    <Textarea 
                      placeholder="Descreva o conteúdo da notificação..." 
                      value={notificationForm.description}
                      onChange={(e) => setNotificationForm({...notificationForm, description: e.target.value})}
                      className="bg-[var(--bg-tertiary)] border-[var(--border-color)] min-h-[100px]"
                    />
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full md:w-auto gap-2" 
                      disabled={notificationLoading}
                    >
                      {notificationLoading ? 'Enviando...' : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Notificação
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-color)]">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-[var(--text-primary)]">
                    <Bell className="w-4 h-4" />
                    Como funciona?
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    As notificações enviadas aqui aparecerão na central de notificações dos usuários (ícone de sino) no painel deles. 
                    Se o usuário estiver offline, a notificação será entregue assim que ele fizer login.
                    O broadcast envia uma cópia individual para cada usuário cadastrado no sistema.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="email-templates">
              <h2 className="text-lg font-semibold mb-4">Templates de E-mail</h2>
              <div className="space-y-4">
                {[
                  {
                    id: 'welcome',
                    title: 'Criação de conta',
                    enabledKey: 'emailWelcomeEnabled',
                    subjectKey: 'emailWelcomeSubject',
                    bodyKey: 'emailWelcomeBody'
                  },
                  {
                    id: 'reset-password',
                    title: 'Recuperação de senha',
                    enabledKey: 'emailResetPasswordEnabled',
                    subjectKey: 'emailResetPasswordSubject',
                    bodyKey: 'emailResetPasswordBody'
                  },
                  {
                    id: 'consultancy-reminder',
                    title: 'Lembrete de cobrança de consultoria',
                    enabledKey: 'emailConsultancyReminderEnabled',
                    subjectKey: 'emailConsultancyReminderSubject',
                    bodyKey: 'emailConsultancyReminderBody'
                  }
                ].map((template) => (
                  <div key={template.id} className="rounded-xl border border-[var(--border-color)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--text-primary)]">{template.title}</h3>
                      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={settingsForm[template.enabledKey] === 'true'}
                          onChange={(e) => {
                            setSettingsForm({
                              ...settingsForm,
                              [template.enabledKey]: e.target.checked ? 'true' : 'false'
                            });
                          }}
                        />
                        Ativo
                      </label>
                    </div>
                    <Input
                      name={template.subjectKey}
                      value={settingsForm[template.subjectKey] || ''}
                      onChange={handleSettingsChange}
                      placeholder="Assunto do e-mail"
                      disabled={settingsForm[template.enabledKey] !== 'true'}
                    />
                    <Textarea
                      name={template.bodyKey}
                      value={settingsForm[template.bodyKey] || ''}
                      onChange={handleSettingsChange}
                      placeholder="Conteúdo HTML do e-mail"
                      className="min-h-[180px]"
                      disabled={settingsForm[template.enabledKey] !== 'true'}
                    />
                  </div>
                ))}

                <div className="rounded-xl border border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)] space-y-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Atalhos disponíveis</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Use os atalhos abaixo dentro do assunto ou corpo. Exemplo: Olá {`{{cliente_nome}}`}.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {EMAIL_SHORTCUTS.map((shortcut) => (
                      <div key={shortcut.key} className="text-sm text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{shortcut.key}</span> — {shortcut.description}
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="default" onClick={handleSettingsSave} disabled={loading}>Salvar</Button>
              </div>
            </TabsContent>
            <TabsContent value="settings">
              <h2 className="text-lg font-semibold mb-4">Configurações Gerais</h2>
              <div className="space-y-4">
                <Input name="organizationName" value={settingsForm.organizationName || ''} onChange={handleSettingsChange} placeholder="Nome da Organização" />
                <Input name="cnpj" value={settingsForm.cnpj || ''} onChange={handleSettingsChange} placeholder="CNPJ" />
                <Input name="address" value={settingsForm.address || ''} onChange={handleSettingsChange} placeholder="Endereço" />
                <Button variant="default" onClick={handleSettingsSave} disabled={loading}>Salvar</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[var(--bg-card)] border-[var(--border-color)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Alterar Senha do Usuário</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Defina uma nova senha para o usuário <strong>{selectedUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Nova senha (mínimo 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading} className="bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={loading} className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90">
              {loading ? 'Alterando...' : 'Salvar Nova Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-900 border-[var(--border-color)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Ativar Assinatura</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Ative uma assinatura para o usuário <strong>{selectedUserForSubscription?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">Plano</label>
              <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
                <SelectTrigger className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">Período de Faturamento</label>
              <Select value={subscriptionBillingPeriod} onValueChange={setSubscriptionBillingPeriod}>
                <SelectTrigger className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubscriptionDialogOpen(false)} disabled={loading} className="bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
              Cancelar
            </Button>
            <Button onClick={handleActivateSubscription} disabled={loading} className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90">
              {loading ? 'Ativando...' : 'Ativar Assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
