import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { offlineFetch, isOnline, clearCache, useOfflineStatus, flushQueue } from '../lib/offline';
import { getSettings, updateSettings, changePassword, getGlobalSettings, updateGlobalSettings } from '../lib/api';
import { 
  User, Briefcase, MapPin, DollarSign, FileText, Settings, Users, 
  Building2, Upload, ImageIcon, CheckCircle, Lock, Mail, Eye, EyeOff,
  Database, Trash2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { motion } from 'framer-motion';
import MobileTabsAccordion from '../components/MobileTabsAccordion';
import { digitsOnly, formatCpfCnpj, formatNumberDigits, formatPhoneBr } from '../lib/utils';

export default function ProfileSettings() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [showFiscalApiKeyWarning, setShowFiscalApiKeyWarning] = useState(false);
  const { pendingCount, isSyncing } = useOfflineStatus();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });

  const [formData, setFormData] = useState({
    profile_type: 'autonomo',
    full_name: '',
    fantasy_name: '',
    logo_url: '',
    photo_url: '',
    description: '',
    crmv: '',
    crmv_state: '',
    specialties: [],
    service_types: [],
    signature_url: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    bank_account: '',
    pix_key: '',
    payment_methods: [],
    default_payment_term: '30',
    currency: 'BRL',
    person_type: 'PF',
    fiscal_document: '',
    municipal_registration: '',
    tax_regime: 'simples_nacional',
    service_code: '',
    emission_city: '',
    fiscal_environment: 'homologacao',
    nf_enabled: false,
    fiscal_api_key: '',
    theme: 'dark',
    field_mode: false,
    language: 'pt-BR',
    date_format: 'dd/MM/yyyy',
    km_rate: '',
    min_displacement_value: '',
    emergency_surcharge: '',
    weekend_surcharge: '',
    night_surcharge: '',
    monthly_goal: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [smtpData, setSmtpData] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'false',
    smtp_from: ''
  });

  const { data: globalSettings, isLoading: isLoadingGlobal } = useQuery({
    queryKey: ['global-settings'],
    queryFn: getGlobalSettings,
    enabled: !!user && user.email === 'admin@duovet.app'
  });

  useEffect(() => {
    if (globalSettings) {
      setSmtpData({
        smtp_host: globalSettings.smtp_host || '',
        smtp_port: globalSettings.smtp_port || '587',
        smtp_user: globalSettings.smtp_user || '',
        smtp_pass: globalSettings.smtp_pass || '',
        smtp_secure: String(globalSettings.smtp_secure) || 'false',
        smtp_from: globalSettings.smtp_from || ''
      });
    }
  }, [globalSettings]);

  useEffect(() => {
    if (settings) {
      // Merge settings into formData, parsing numbers/booleans where needed
      setFormData(prev => ({
        ...prev,
        ...settings,
        // Ensure specific fields are correctly typed if backend returns strings
        nf_enabled: settings.nf_enabled === 'true' || settings.nf_enabled === true,
        field_mode: settings.field_mode === 'true' || settings.field_mode === true,
        phone: formatPhoneBr(settings.phone || ''),
        whatsapp: formatPhoneBr(settings.whatsapp || ''),
        fiscal_document: formatCpfCnpj(settings.fiscal_document || ''),
        default_payment_term: formatNumberDigits(settings.default_payment_term || '30'),
        km_rate: settings.km_rate || '',
        min_displacement_value: settings.min_displacement_value || '',
        monthly_goal: formatNumberDigits(settings.monthly_goal || '')
      }));
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.name || prev.full_name,
        email: user.email || prev.email
      }));
    }
  }, [settings, user]);

  useEffect(() => {
    if (!settings) return;
    const key = String(settings?.fiscal_api_key || '').trim();
    if (!key) {
      setShowFiscalApiKeyWarning(true);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações: ' + error.message);
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => {
      toast.error('Erro ao alterar senha: ' + (error.response?.data?.error || error.message));
    }
  });

  const saveSmtpMutation = useMutation({
    mutationFn: updateGlobalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      toast.success('Configurações SMTP salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações SMTP: ' + error.message);
    }
  });

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if online
    if (!isOnline()) {
      toast.error('Você precisa estar online para enviar arquivos');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Falha no upload');
      }

      const data = await response.json();
      
      setFormData(prev => ({ ...prev, [field]: data.url }));
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      phone: formatPhoneBr(formData.phone || ''),
      whatsapp: formatPhoneBr(formData.whatsapp || ''),
      fiscal_document: formatCpfCnpj(formData.fiscal_document || ''),
      default_payment_term: Number(digitsOnly(formData.default_payment_term)) || 0,
      monthly_goal: Number(digitsOnly(formData.monthly_goal)) || 0
    });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    });
  };

  const handleSmtpSubmit = (e) => {
    e.preventDefault();
    saveSmtpMutation.mutate(smtpData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  const isProfileEmpty = !settings || (!settings.full_name && !settings.fantasy_name && !settings.crmv);

  const tabs = [
    { label: 'Geral', icon: User, value: 'general' },
    { label: 'Profissional', icon: Briefcase, value: 'professional' },
    { label: 'Contato', icon: MapPin, value: 'contact' },
    { label: 'Financeiro', icon: DollarSign, value: 'financial' },
    { label: 'Fiscal', icon: FileText, value: 'fiscal' },
    { label: 'Preferências', icon: Settings, value: 'preferences' },
    { label: 'Segurança', icon: Lock, value: 'security' },
    { label: 'Usuários', icon: Users, value: 'users' },
    { label: 'Sistema', icon: Database, value: 'system' },
  ];

  if (user?.email === 'admin@duovet.app') {
    tabs.push({ label: 'SMTP', icon: Mail, value: 'smtp' });
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Dialog open={showFiscalApiKeyWarning} onOpenChange={setShowFiscalApiKeyWarning}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Chave de API Fiscal não configurada</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Entre em contato com seu contador para solicitar as chaves necessárias para emissão de NF
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setShowFiscalApiKeyWarning(false)}
              className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Perfil Profissional
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            Configure seus dados profissionais, fiscais e preferências do sistema
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-[var(--border-color)] bg-[var(--bg-card)]"
          onClick={() => window.dispatchEvent(new CustomEvent('duovet:start-onboarding'))}
        >
          Ver tutorial novamente
        </Button>
      </div>

      {/* Empty State */}
      {isProfileEmpty && (
        <Card className="bg-blue-500/10 border border-blue-200 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-1">Complete seu perfil</p>
                <p className="text-sm text-blue-700">
                  Essas informações aparecerão em relatórios, prescrições e documentos que você gerar. Preencha os dados abaixo para personalizar seus documentos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        {/* Desktop Tabs */}
        <div className="hidden md:block">
          <Tabs defaultValue="general" className="w-full">
          <TabsList className={`grid w-full bg-[var(--bg-card)] h-auto rounded-xl p-1 gap-1 ${user?.email === 'admin@duovet.app' ? 'grid-cols-10' : 'grid-cols-9'}`}>
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value} 
                className="rounded-lg text-xs lg:text-sm data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white"
              >
                <tab.icon className="w-4 h-4 mr-1 lg:mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Aba 1: Dados Gerais */}
          <TabsContent value="general" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Tipo de Perfil</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Selecione se você é autônomo ou representa uma empresa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <select
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.profile_type}
                    onChange={(e) => setFormData({...formData, profile_type: e.target.value})}
                  >
                    <option value="autonomo">Veterinário Autônomo</option>
                    <option value="empresa">Clínica / Empresa</option>
                  </select>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Identidade Visual</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Logo e foto que aparecerão em documentos e relatórios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Logo */}
                    <div>
                      <Label className="text-[var(--text-primary)] mb-3 block">Logo</Label>
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-32 h-32 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center overflow-hidden border-2 border-[var(--border-color)]">
                          {formData.logo_url ? (
                            <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-12 h-12 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <input
                          type="file"
                          id="logo"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'logo_url')}
                          className="hidden"
                        />
                        <label htmlFor="logo">
                          <Button type="button" variant="outline" asChild disabled={isUploading} className="rounded-xl">
                            <span className="cursor-pointer">
                              <Upload className="w-4 h-4 mr-2" />
                              {isUploading ? 'Enviando...' : 'Enviar Logo'}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>

                    {/* Foto */}
                    <div>
                      <Label className="text-[var(--text-primary)] mb-3 block">Foto Profissional</Label>
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-32 h-32 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center overflow-hidden border-2 border-[var(--border-color)]">
                          {formData.photo_url ? (
                            <img src={formData.photo_url} alt="Foto" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-12 h-12 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <input
                          type="file"
                          id="photo"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'photo_url')}
                          className="hidden"
                        />
                        <label htmlFor="photo">
                          <Button type="button" variant="outline" asChild disabled={isUploading} className="rounded-xl">
                            <span className="cursor-pointer">
                              <Upload className="w-4 h-4 mr-2" />
                              {isUploading ? 'Enviando...' : 'Enviar Foto'}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">
                        {formData.profile_type === 'empresa' ? 'Razão Social' : 'Nome Completo'}
                      </Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Nome Fantasia</Label>
                      <Input
                        value={formData.fantasy_name}
                        onChange={(e) => setFormData({ ...formData, fantasy_name: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)]">Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      rows={3}
                      placeholder="Breve descrição sobre você ou sua clínica..."
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba 2: Dados Profissionais */}
          <TabsContent value="professional" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Registro Profissional</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">CRMV</Label>
                      <Input
                        value={formData.crmv}
                        onChange={(e) => setFormData({ ...formData, crmv: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="Número do CRMV"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">UF do CRMV</Label>
                      <Input
                        value={formData.crmv_state}
                        onChange={(e) => setFormData({ ...formData, crmv_state: e.target.value.toUpperCase() })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Assinatura Digital</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Upload da sua assinatura para documentos e relatórios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-sm h-32 bg-[var(--bg-tertiary)] rounded-xl flex items-center justify-center overflow-hidden border-2 border-[var(--border-color)]">
                      {formData.signature_url ? (
                        <img src={formData.signature_url} alt="Assinatura" className="max-h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <input
                      type="file"
                      id="signature"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'signature_url')}
                      className="hidden"
                    />
                    <label htmlFor="signature">
                      <Button type="button" variant="outline" asChild disabled={isUploading} className="rounded-xl">
                        <span className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploading ? 'Enviando...' : 'Enviar Assinatura'}
                        </span>
                      </Button>
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Valores de Deslocamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">Valor por KM (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.km_rate}
                        onChange={(e) => setFormData({ ...formData, km_rate: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="2.50"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Valor Mínimo (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.min_displacement_value}
                        onChange={(e) => setFormData({ ...formData, min_displacement_value: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="50.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Acréscimos</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Percentuais de acréscimo para situações especiais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">Emergência (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.emergency_surcharge}
                        onChange={(e) => setFormData({ ...formData, emergency_surcharge: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Fim de Semana (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.weekend_surcharge}
                        onChange={(e) => setFormData({ ...formData, weekend_surcharge: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Noturno (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.night_surcharge}
                        onChange={(e) => setFormData({ ...formData, night_surcharge: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="40"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba 3: Endereço e Contato */}
          <TabsContent value="contact" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Endereço</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-[var(--text-primary)]">Endereço Completo</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder="Rua, número, bairro"
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">Cidade</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Estado</Label>
                      <Input
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">CEP</Label>
                      <Input
                        value={formData.zip_code}
                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Contatos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">Telefone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: formatPhoneBr(e.target.value) })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">WhatsApp</Label>
                      <Input
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: formatPhoneBr(e.target.value) })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">E-mail</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="contato@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Website / Rede Social</Label>
                      <Input
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba 4: Financeiro */}
          <TabsContent value="financial" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Dados Bancários</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Informações para recebimentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-[var(--text-primary)]">Conta Bancária</Label>
                    <Input
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder="Banco, Agência, Conta"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)]">Chave Pix</Label>
                    <Input
                      value={formData.pix_key}
                      onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Configurações de Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[var(--text-primary)]">Prazo Padrão (dias)</Label>
                      <Input
                        value={formData.default_payment_term}
                        onChange={(e) => setFormData({ ...formData, default_payment_term: formatNumberDigits(e.target.value) })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="30"
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Moeda</Label>
                      <select
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      >
                        <option value="BRL">BRL - Real Brasileiro</option>
                        <option value="USD">USD - Dólar Americano</option>
                        <option value="EUR">EUR - Euro</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[var(--text-primary)]">Meta de Receita Mensal (R$)</Label>
                      <Input
                        value={formData.monthly_goal}
                        onChange={(e) => setFormData({ ...formData, monthly_goal: formatNumberDigits(e.target.value) })}
                        className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        placeholder="Ex: 10.000"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba 5: Fiscal */}
          <TabsContent value="fiscal" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Identificação Fiscal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-[var(--text-primary)]">Tipo de Pessoa</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      value={formData.person_type}
                      onChange={(e) => setFormData({...formData, person_type: e.target.value})}
                    >
                      <option value="PF">Pessoa Física</option>
                      <option value="PJ">Pessoa Jurídica</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)]">
                      {formData.person_type === 'PF' ? 'CPF' : 'CNPJ'}
                    </Label>
                    <Input
                      value={formData.fiscal_document}
                      onChange={(e) => setFormData({ ...formData, fiscal_document: formatCpfCnpj(e.target.value) })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder={formData.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                    />
                  </div>
                  {formData.person_type === 'PJ' && (
                    <>
                      <div>
                        <Label className="text-[var(--text-primary)]">Inscrição Municipal</Label>
                        <Input
                          value={formData.municipal_registration}
                          onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })}
                          className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                        />
                      </div>
                      <div>
                        <Label className="text-[var(--text-primary)]">Regime Tributário</Label>
                        <select
                          className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          value={formData.tax_regime}
                          onChange={(e) => setFormData({...formData, tax_regime: e.target.value})}
                        >
                          <option value="simples_nacional">Simples Nacional</option>
                          <option value="lucro_presumido">Lucro Presumido</option>
                          <option value="lucro_real">Lucro Real</option>
                          <option value="mei">MEI</option>
                        </select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Emissão de Nota Fiscal</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Configure a emissão automática de NF-e
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Emissão Automática</p>
                      <p className="text-sm text-[var(--text-muted)]">Ativar emissão de NF para faturamentos</p>
                    </div>
                    <Switch
                      checked={formData.nf_enabled}
                      onCheckedChange={(val) => setFormData({...formData, nf_enabled: val})}
                    />
                  </div>

                  <div>
                    <Label className="text-[var(--text-primary)]">Ambiente Fiscal</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      value={formData.fiscal_environment}
                      onChange={(e) => setFormData({...formData, fiscal_environment: e.target.value})}
                    >
                      <option value="homologacao">Homologação (Testes)</option>
                      <option value="producao">Produção</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[var(--text-primary)]">Código de Serviço</Label>
                    <Input
                      value={formData.service_code}
                      onChange={(e) => setFormData({ ...formData, service_code: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder="Ex: 1701"
                    />
                  </div>

                  <div>
                    <Label className="text-[var(--text-primary)]">Município de Emissão</Label>
                    <Input
                      value={formData.emission_city}
                      onChange={(e) => setFormData({ ...formData, emission_city: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                    />
                  </div>

                  <div>
                    <Label className="text-[var(--text-primary)] flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Chave da API Fiscal
                    </Label>
                    <Input
                      type="password"
                      value={formData.fiscal_api_key}
                      onChange={(e) => setFormData({ ...formData, fiscal_api_key: e.target.value })}
                      className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                      placeholder="••••••••••••••••"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Esta chave de API é individual e fornecida pelo seu integrador fiscal (ex: e-Notas, FocusNFe). 
                      Acesse o painel do integrador {'>'} Configurações {'>'} API para gerar sua chave.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba 6: Preferências */}
          <TabsContent value="preferences" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Aparência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-[var(--text-primary)]">Tema do Sistema</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      value={formData.theme}
                      onChange={(e) => setFormData({...formData, theme: e.target.value})}
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Escuro</option>
                      <option value="auto">Automático</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Modo Campo</p>
                      <p className="text-sm text-[var(--text-muted)]">Interface simplificada para uso em campo</p>
                    </div>
                    <Switch
                      checked={formData.field_mode}
                      onCheckedChange={(val) => setFormData({...formData, field_mode: val})}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Regionalização</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-[var(--text-primary)]">Idioma</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      value={formData.language}
                      onChange={(e) => setFormData({...formData, language: e.target.value})}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                      <option value="es-ES">Español</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)]">Formato de Data</Label>
                    <select
                      className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      value={formData.date_format}
                      onChange={(e) => setFormData({...formData, date_format: e.target.value})}
                    >
                      <option value="dd/MM/yyyy">DD/MM/AAAA</option>
                      <option value="MM/dd/yyyy">MM/DD/AAAA</option>
                      <option value="yyyy-MM-dd">AAAA-MM-DD</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba: Segurança */}
          <TabsContent value="security" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Alterar Senha</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Mantenha sua conta segura alterando sua senha periodicamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[var(--text-primary)]">Senha Atual</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                          className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[var(--text-primary)]">Nova Senha</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords.new ? "text" : "password"}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[var(--text-primary)]">Confirmar Nova Senha</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords.confirm ? "text" : "password"}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          >
                            {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button 
                        type="submit" 
                        disabled={changePasswordMutation.isPending}
                        className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl h-11 px-8"
                      >
                        {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Aba: SMTP (Admin Only) */}
          {user?.email === 'admin@duovet.app' && (
            <TabsContent value="smtp" className="mt-6 space-y-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-[var(--text-primary)]">Configuração SMTP Global</CardTitle>
                    <CardDescription className="text-[var(--text-muted)]">
                      Configurações de e-mail utilizadas para recuperação de senha e notificações do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSmtpSubmit} className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">Servidor SMTP</Label>
                          <Input
                            value={smtpData.smtp_host}
                            onChange={(e) => setSmtpData({...smtpData, smtp_host: e.target.value})}
                            placeholder="smtp.exemplo.com"
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">Porta</Label>
                          <Input
                            value={smtpData.smtp_port}
                            onChange={(e) => setSmtpData({...smtpData, smtp_port: e.target.value})}
                            placeholder="587"
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">Usuário</Label>
                          <Input
                            value={smtpData.smtp_user}
                            onChange={(e) => setSmtpData({...smtpData, smtp_user: e.target.value})}
                            placeholder="contato@exemplo.com"
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">Senha</Label>
                          <Input
                            type="password"
                            value={smtpData.smtp_pass}
                            onChange={(e) => setSmtpData({...smtpData, smtp_pass: e.target.value})}
                            placeholder="••••••••"
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">E-mail de Remetente</Label>
                          <Input
                            value={smtpData.smtp_from}
                            onChange={(e) => setSmtpData({...smtpData, smtp_from: e.target.value})}
                            placeholder="DuoVet <contato@duovet.app>"
                            className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[var(--text-primary)]">Conexão Segura (SSL/TLS)</Label>
                          <select
                            className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            value={smtpData.smtp_secure}
                            onChange={(e) => setSmtpData({...smtpData, smtp_secure: e.target.value})}
                          >
                            <option value="false">Não (STARTTLS/Porta 587)</option>
                            <option value="true">Sim (SSL/TLS/Porta 465)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button 
                          type="submit" 
                          disabled={saveSmtpMutation.isPending}
                          className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl h-11 px-8"
                        >
                          {saveSmtpMutation.isPending ? 'Salvando...' : 'Salvar Configurações SMTP'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}

          {/* Aba 7: Usuários e Permissões */}
          <TabsContent value="users" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-amber-500/10 border border-amber-200 rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex gap-3">
                    <Users className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 mb-1">Funcionalidade em Desenvolvimento</p>
                      <p className="text-sm text-amber-700">
                        O gerenciamento de múltiplos usuários e permissões estará disponível em breve.
                        Por enquanto, utilize o sistema com o usuário principal.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Usuário Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 bg-[var(--bg-tertiary)] rounded-xl">
                    <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{user?.full_name}</p>
                      <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Admin • Acesso Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="system" className="mt-6 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)]">Sincronização Offline</CardTitle>
                  <CardDescription className="text-[var(--text-muted)]">
                    Gerencie os dados salvos localmente e a fila de sincronização
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pendingCount > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'}`}>
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          {pendingCount > 0 ? `${pendingCount} alterações pendentes` : 'Tudo sincronizado'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {isOnline() ? 'Conectado à internet' : 'Modo offline ativo'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => flushQueue()}
                      disabled={!isOnline() || isSyncing || pendingCount === 0}
                      className="rounded-lg"
                    >
                      Sincronizar Agora
                    </Button>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Limpar Cache Local</p>
                        <p className="text-sm text-[var(--text-muted)]">Remove dados temporários e imagens cacheadas. Não afeta seus dados no servidor.</p>
                      </div>
                      <Button 
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          const count = await clearCache();
                          toast.success(`${count} itens removidos do cache`);
                        }}
                        className="rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Limpar Cache
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[var(--text-primary)] text-sm">Informações Técnicas</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[var(--text-muted)] space-y-1">
                  <p>Versão do App: 1.0.0 (Build 20240321)</p>
                  <p>Plataforma: {typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}</p>
                  <p>Storage: Capacitor Preferences / PWA Service Worker</p>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          </Tabs>
          </div>

          {/* Mobile Accordion Tabs */}
          <div className="md:hidden">
          <MobileTabsAccordion 
           isDarkMode={false}
           tabs={[
             {
               label: 'Geral',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">Tipo de Perfil</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.profile_type}
                       onChange={(e) => setFormData({...formData, profile_type: e.target.value})}
                     >
                       <option value="autonomo">Veterinário Autônomo</option>
                       <option value="empresa">Clínica / Empresa</option>
                     </select>
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">{formData.profile_type === 'empresa' ? 'Razão Social' : 'Nome Completo'}</Label>
                     <Input
                       value={formData.full_name}
                       onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Nome Fantasia</Label>
                     <Input
                       value={formData.fantasy_name}
                       onChange={(e) => setFormData({ ...formData, fantasy_name: e.target.value })}
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                       placeholder="Opcional"
                     />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Descrição</Label>
                     <Textarea
                       value={formData.description}
                       onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                       className="rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                       rows={3}
                       placeholder="Breve descrição..."
                     />
                   </div>
                 </div>
               )
             },
             {
               label: 'Profissional',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">CRMV</Label>
                     <Input value={formData.crmv} onChange={(e) => setFormData({ ...formData, crmv: e.target.value })} className="h-11 rounded-xl" placeholder="Número do CRMV" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">UF do CRMV</Label>
                     <Input value={formData.crmv_state} onChange={(e) => setFormData({ ...formData, crmv_state: e.target.value.toUpperCase() })} className="h-11 rounded-xl" placeholder="SP" maxLength={2} />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Valor por KM (R$)</Label>
                     <Input type="number" step="0.01" value={formData.km_rate} onChange={(e) => setFormData({ ...formData, km_rate: e.target.value })} className="h-11 rounded-xl" placeholder="2.50" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Valor Mínimo (R$)</Label>
                     <Input type="number" step="0.01" value={formData.min_displacement_value} onChange={(e) => setFormData({ ...formData, min_displacement_value: e.target.value })} className="h-11 rounded-xl" placeholder="50.00" />
                   </div>
                 </div>
               )
             },
             {
               label: 'Contato',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">Telefone</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhoneBr(e.target.value) })} className="h-11 rounded-xl" placeholder="(00) 00000-0000" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">WhatsApp</Label>
                    <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: formatPhoneBr(e.target.value) })} className="h-11 rounded-xl" placeholder="(00) 00000-0000" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">E-mail</Label>
                     <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-11 rounded-xl" placeholder="contato@exemplo.com" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Website</Label>
                     <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="h-11 rounded-xl" placeholder="https://..." />
                   </div>
                 </div>
               )
             },
             {
               label: 'Financeiro',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">Conta Bancária</Label>
                     <Input value={formData.bank_account} onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })} className="h-11 rounded-xl" placeholder="Banco, Agência, Conta" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Chave Pix</Label>
                     <Input value={formData.pix_key} onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })} className="h-11 rounded-xl" placeholder="CPF, CNPJ, e-mail..." />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Prazo Padrão (dias)</Label>
                    <Input value={formData.default_payment_term} onChange={(e) => setFormData({ ...formData, default_payment_term: formatNumberDigits(e.target.value) })} className="h-11 rounded-xl" placeholder="30" inputMode="numeric" />
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Moeda</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.currency}
                       onChange={(e) => setFormData({...formData, currency: e.target.value})}
                     >
                       <option value="BRL">BRL - Real</option>
                       <option value="USD">USD - Dólar</option>
                       <option value="EUR">EUR - Euro</option>
                     </select>
                   </div>
                 </div>
               )
             },
             {
               label: 'Fiscal',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">Tipo de Pessoa</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.person_type}
                       onChange={(e) => setFormData({...formData, person_type: e.target.value})}
                     >
                       <option value="PF">Pessoa Física</option>
                       <option value="PJ">Pessoa Jurídica</option>
                     </select>
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">{formData.person_type === 'PF' ? 'CPF' : 'CNPJ'}</Label>
                    <Input value={formData.fiscal_document} onChange={(e) => setFormData({ ...formData, fiscal_document: formatCpfCnpj(e.target.value) })} className="h-11 rounded-xl" placeholder={formData.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} />
                   </div>
                   {formData.person_type === 'PJ' && (
                     <>
                       <div>
                         <Label className="text-[var(--text-primary)]">Inscrição Municipal</Label>
                         <Input value={formData.municipal_registration} onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })} className="h-11 rounded-xl" />
                       </div>
                       <div>
                         <Label className="text-[var(--text-primary)]">Regime Tributário</Label>
                         <select
                           className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                           value={formData.tax_regime}
                           onChange={(e) => setFormData({...formData, tax_regime: e.target.value})}
                         >
                           <option value="simples_nacional">Simples Nacional</option>
                           <option value="lucro_presumido">Lucro Presumido</option>
                           <option value="lucro_real">Lucro Real</option>
                           <option value="mei">MEI</option>
                         </select>
                       </div>
                     </>
                   )}
                   
                   <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl mt-4">
                     <div>
                       <p className="font-medium text-[var(--text-primary)]">Emissão Automática</p>
                       <p className="text-sm text-[var(--text-muted)]">Ativar emissão de NF</p>
                     </div>
                     <Switch
                       checked={formData.nf_enabled}
                       onCheckedChange={(val) => setFormData({...formData, nf_enabled: val})}
                     />
                   </div>

                   <div>
                     <Label className="text-[var(--text-primary)]">Ambiente Fiscal</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.fiscal_environment}
                       onChange={(e) => setFormData({...formData, fiscal_environment: e.target.value})}
                     >
                       <option value="homologacao">Homologação (Testes)</option>
                       <option value="producao">Produção</option>
                     </select>
                   </div>

                   <div>
                     <Label className="text-[var(--text-primary)]">Código de Serviço</Label>
                     <Input
                       value={formData.service_code}
                       onChange={(e) => setFormData({ ...formData, service_code: e.target.value })}
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                       placeholder="Ex: 1701"
                     />
                   </div>

                   <div>
                     <Label className="text-[var(--text-primary)]">Município de Emissão</Label>
                     <Input
                       value={formData.emission_city}
                       onChange={(e) => setFormData({ ...formData, emission_city: e.target.value })}
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>

                   <div>
                     <Label className="text-[var(--text-primary)] flex items-center gap-2">
                       <Lock className="w-4 h-4" />
                       Chave da API Fiscal
                     </Label>
                     <Input
                       type="password"
                       value={formData.fiscal_api_key}
                       onChange={(e) => setFormData({ ...formData, fiscal_api_key: e.target.value })}
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                       placeholder="••••••••••••••••"
                     />
                   </div>
                 </div>
               )
             },
             {
               label: 'Preferências',
               content: (
                 <div className="space-y-4">
                   <div>
                     <Label className="text-[var(--text-primary)]">Tema</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.theme}
                       onChange={(e) => setFormData({...formData, theme: e.target.value})}
                     >
                       <option value="light">Claro</option>
                       <option value="dark">Escuro</option>
                       <option value="auto">Automático</option>
                     </select>
                   </div>
                   <div>
                     <Label className="text-[var(--text-primary)]">Idioma</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={formData.language}
                       onChange={(e) => setFormData({...formData, language: e.target.value})}
                     >
                       <option value="pt-BR">Português (Brasil)</option>
                       <option value="en-US">English</option>
                       <option value="es-ES">Español</option>
                     </select>
                   </div>
                 </div>
               )
             },
             {
               label: 'Usuários',
               content: (
                 <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-200">
                   <Users className="w-5 h-5 text-amber-700 flex-shrink-0" />
                   <p className="text-xs text-amber-700">Funcionalidade em desenvolvimento. Em breve você poderá gerenciar múltiplos usuários.</p>
                 </div>
               )
             },
             {
               label: 'Alterar Senha',
               content: (
                 <div className="space-y-4 pt-2">
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Senha Atual</Label>
                     <div className="relative">
                       <Input
                         type={showPasswords.current ? "text" : "password"}
                         value={passwordData.currentPassword}
                         onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                         className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                       />
                       <button
                         type="button"
                         onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                       >
                         {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Nova Senha</Label>
                     <div className="relative">
                       <Input
                         type={showPasswords.new ? "text" : "password"}
                         value={passwordData.newPassword}
                         onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                         className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                         minLength={6}
                       />
                       <button
                         type="button"
                         onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                       >
                         {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Confirmar Nova Senha</Label>
                     <div className="relative">
                       <Input
                         type={showPasswords.confirm ? "text" : "password"}
                         value={passwordData.confirmPassword}
                         onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                         className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] pr-10"
                       />
                       <button
                         type="button"
                         onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                       >
                         {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                   </div>
                   <Button 
                     type="button"
                     onClick={(e) => {
                       e.preventDefault();
                       handlePasswordSubmit(e);
                     }}
                     disabled={changePasswordMutation.isPending}
                     className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl h-11"
                   >
                     {changePasswordMutation.isPending ? 'Alterando...' : 'Alterar Senha'}
                   </Button>
                 </div>
               )
             },
             ...(user?.email === 'admin@duovet.app' ? [{
               label: 'SMTP (Global)',
               content: (
                 <div className="space-y-4 pt-2">
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Servidor SMTP</Label>
                     <Input
                       value={smtpData.smtp_host}
                       onChange={(e) => setSmtpData({...smtpData, smtp_host: e.target.value})}
                       placeholder="smtp.exemplo.com"
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Porta</Label>
                     <Input
                       value={smtpData.smtp_port}
                       onChange={(e) => setSmtpData({...smtpData, smtp_port: e.target.value})}
                       placeholder="587"
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Usuário</Label>
                     <Input
                       value={smtpData.smtp_user}
                       onChange={(e) => setSmtpData({...smtpData, smtp_user: e.target.value})}
                       placeholder="contato@exemplo.com"
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Senha</Label>
                     <Input
                       type="password"
                       value={smtpData.smtp_pass}
                       onChange={(e) => setSmtpData({...smtpData, smtp_pass: e.target.value})}
                       placeholder="••••••••"
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">E-mail de Remetente</Label>
                     <Input
                       value={smtpData.smtp_from}
                       onChange={(e) => setSmtpData({...smtpData, smtp_from: e.target.value})}
                       placeholder="DuoVet <contato@duovet.app>"
                       className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[var(--text-primary)]">Conexão Segura</Label>
                     <select
                       className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                       value={smtpData.smtp_secure}
                       onChange={(e) => setSmtpData({...smtpData, smtp_secure: e.target.value})}
                     >
                       <option value="false">Não (STARTTLS/587)</option>
                       <option value="true">Sim (SSL/TLS/465)</option>
                     </select>
                   </div>
                   <Button 
                     type="button"
                     onClick={(e) => {
                       e.preventDefault();
                       handleSmtpSubmit(e);
                     }}
                     disabled={saveSmtpMutation.isPending}
                     className="w-full bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl h-11 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                   >
                     {saveSmtpMutation.isPending ? 'Salvando...' : 'Salvar SMTP'}
                   </Button>
                 </div>
               )
             }] : [])
           ]}
           defaultTab={0}
           
          />
          </div>

          {/* Save Button */}
        <div className="mt-6">
          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black text-base dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
