import React, { useState } from 'react';
// import { base44 } from '../api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  CheckCircle, Shield, CreditCard, Calendar, Users, 
  Stethoscope, FileText, Smartphone, TrendingUp, 
  Crown, Lock, Zap, PawPrint, Sparkles, Mail, HelpCircle, X, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { offlineFetch, enqueueMutation, apiFetch, getAuthTokenAsync } from '../lib/offline';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContextJWT';
import { getGlobalSettings } from '../lib/api';

const parsePrice = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toSafeNumber = (value, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value !== 'string') return fallback;

  let cleaned = value.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return fallback;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    if (decimalSeparator === ',') {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const TRIAL_DAYS = 7;

const getRemainingTime = (targetDate) => {
  if (!targetDate) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, expired: true };
  }

  const diffMs = new Date(targetDate).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, expired: true };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { totalMs: diffMs, days, hours, minutes, expired: false };
};

const getPeriodUsage = (startDate, endDate) => {
  const startMs = startDate ? new Date(startDate).getTime() : NaN;
  const endMs = endDate ? new Date(endDate).getTime() : NaN;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  const totalMs = endMs - startMs;
  const elapsedMs = Math.min(Math.max(Date.now() - startMs, 0), totalMs);
  return Math.round((elapsedMs / totalMs) * 100);
};

export default function MySubscription() {
  const { user, isAuthenticated } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['global-settings'],
    queryFn: getGlobalSettings
  });

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const subs = await offlineFetch(`/api/subscriptions?user_id=${user.id}`);
      return subs && subs.length > 0 ? subs[0] : null;
    },
    enabled: !!user?.id,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me || null;
    },
    enabled: !!user?.id
  });

  const plans = {
    autonomo: {
      id: 'autonomo',
      name: 'Autônomo',
      active: (settings?.planAutonomoActive ?? 'true') === 'true',
      monthly: parsePrice(settings?.planAutonomoMonthly ?? settings?.planMonthly, 89.9),
      yearly: parsePrice(settings?.planAutonomoYearly ?? settings?.planYearly, 899)
    },
    profissional: {
      id: 'profissional',
      name: 'Profissional',
      active: (settings?.planProfissionalActive ?? 'true') === 'true',
      monthly: parsePrice(
        settings?.planProfissionalMonthly ?? (settings?.planMonthly ? Number(String(settings.planMonthly).replace(',', '.')) * 3.2 : undefined),
        287.68
      ),
      yearly: parsePrice(
        settings?.planProfissionalYearly ?? (settings?.planYearly ? Number(String(settings.planYearly).replace(',', '.')) * 3.2 : undefined),
        2876.8
      )
    },
    empresarial: {
      id: 'empresarial',
      name: 'Empresarial',
      active: (settings?.planEmpresarialActive ?? 'true') === 'true',
      monthly: parsePrice(
        settings?.planEmpresarialMonthly ?? (settings?.planMonthly ? Number(String(settings.planMonthly).replace(',', '.')) * 11 : undefined),
        988.9
      ),
      yearly: parsePrice(
        settings?.planEmpresarialYearly ?? (settings?.planYearly ? Number(String(settings.planYearly).replace(',', '.')) * 11 : undefined),
        9889
      )
    }
  };

  const availablePlans = Object.values(plans).filter((plan) => plan.active);
  const fallbackPlan = availablePlans[0] || null;

  const getPlanPrice = (planId, period) => {
    const plan = plans[planId] || fallbackPlan;
    if (!plan) return 0;
    return period === 'yearly' ? plan.yearly : plan.monthly;
  };

  const currentPlanId = subscription?.plan || fallbackPlan?.id || 'autonomo';
  const currentPrice = getPlanPrice(currentPlanId, billingPeriod) / (billingPeriod === 'yearly' ? 12 : 1);
  const supportWhatsapp = (settings?.supportWhatsapp || '').replace(/\D/g, '');
  const supportEmail = settings?.supportEmail || 'admin@duovet.app';
  const landingPlan = availablePlans[0] || null;
  const hasLandingPlan = !!landingPlan;
  const landingMonthly = landingPlan?.monthly || 0;
  const landingYearly = landingPlan?.yearly || 0;
  const landingCurrentPrice = billingPeriod === 'monthly' ? landingMonthly : landingYearly;

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast.success('Assinatura confirmada com sucesso!');
      // Invalidate queries para forçar refresh
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-payments', user?.id] });
      // Aguarda um pouco para o webhook do Stripe processar
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['subscription', user?.id] });
      }, 1500);
      
      window.history.replaceState({}, '', createPageUrl('MySubscription'));
    } else if (urlParams.get('canceled') === 'true') {
      toast.info('Checkout cancelado. Você pode assinar quando quiser.');
      window.history.replaceState({}, '', createPageUrl('MySubscription'));
    }
  }, [queryClient, user?.id]);

  const isExpiredUser = (userProfile?.status || user?.status) === 'expired';

  const { data: paymentHistory } = useQuery({
    queryKey: ['subscription-payments', user?.id],
    queryFn: async () => {
      const payments = await offlineFetch(`/api/payments/subscriptions/invoices`);
      return payments;
    },
    enabled: !!user?.id && !!subscription && !isExpiredUser,
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await enqueueMutation(`/api/subscriptions/${subscription.id}`, {
        method: 'PUT',
        body: { ...subscription, status: 'canceled' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success('Sua assinatura foi cancelada. Sentiremos sua falta!');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar assinatura: ' + error.message);
    }
  });

  const handleCheckout = async (planId, period) => {
    if (isProcessing) return;
    if (!user?.id || !user?.email) {
      toast.error('Faça login para assinar.');
      return;
    }
    if (!plans[planId]?.active) {
      toast.error('Este plano está indisponível no momento.');
      return;
    }
    const token = await getAuthTokenAsync();
    if (!token) {
      toast.error('Sua sessão expirou. Faça login novamente para assinar.');
      return;
    }
    const amount = toSafeNumber(getPlanPrice(planId, period), 0);
    const priceCents = Math.round(amount * 100);
    setIsProcessing(true);
    toast.loading('Preparando checkout seguro...', { id: 'checkout' });
    try {
      const response = await apiFetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          plan_id: planId,
          billing_period: period,
          price_cents: priceCents
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Não foi possível iniciar o checkout');
      }
      toast.success('Redirecionando para o Stripe...', { id: 'checkout' });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error.message || 'Erro ao processar checkout', { id: 'checkout' });
      setIsProcessing(false);
    }
  };

  const openSupportEmail = () => {
    const subject = encodeURIComponent('Suporte DuoVet - Assinatura');
    const body = encodeURIComponent(
      `Olá, equipe DuoVet.%0D%0A%0D%0APreciso de ajuda com minha assinatura.%0D%0AUsuário: ${user?.email || 'não informado'}%0D%0APlano atual: ${subscription?.plan || 'não informado'}%0D%0A`
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  const openSupportWhatsapp = () => {
    if (!supportWhatsapp) {
      openSupportEmail();
      return;
    }

    const text = encodeURIComponent(
      `Olá, preciso de ajuda com minha assinatura DuoVet. Usuário: ${user?.email || 'não informado'}.`
    );
    window.open(`https://wa.me/${supportWhatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  // Se não estiver logado, não mostramos o spinner de carregamento de assinatura
  if (isLoading && isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#22c55e]/20 border-t-[#22c55e] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Painel de gerenciamento - logado
  if (isAuthenticated) {
    const subscriptionStatus = subscription?.status || null;
    const userStatus = userProfile?.status || user?.status || null;
    const isTrial = subscriptionStatus === 'trialing' || (userStatus === 'trial' && !subscriptionStatus);
    const isActive = subscriptionStatus === 'active' || (userStatus === 'active' && !subscriptionStatus);
    const isCanceled = subscriptionStatus === 'canceled';
    const createdAt = userProfile?.created_at ? new Date(userProfile.created_at) : null;
    const trialEndDate = subscription?.trial_end_date ? new Date(subscription.trial_end_date) : (createdAt ? new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null);
    const daysLeft = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
    const countdownTarget = isTrial ? trialEndDate : (subscription?.next_billing_date || subscription?.end_date || null);
    const countdownStart = isTrial ? createdAt : (subscription?.start_date || createdAt || null);
    const countdown = getRemainingTime(countdownTarget);
    const usagePercent = getPeriodUsage(countdownStart, countdownTarget);

    const planNames = {
      autonomo: 'Autônomo',
      profissional: 'Profissional',
      empresarial: 'Empresarial'
    };
    const currentPlanName = planNames[subscription?.plan] || fallbackPlan?.name || 'Plano';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 dark:from-[#0b0b0f] dark:via-[#111318] dark:to-[#0f1b16] py-12 px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-8 w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 mb-2 tracking-tight">Minha Assinatura</h1>
            <p className="text-lg text-slate-500 dark:text-slate-300 font-medium">Gerencie sua conta DuoVet {currentPlanName}</p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white dark:bg-[#181c23] text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-xl font-bold transition-all relative ${
                billingPeriod === 'yearly'
                  ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white dark:bg-[#181c23] text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Anual
              <Badge className="ml-2 bg-amber-500 text-white text-[10px]">Economize 20%</Badge>
            </button>
          </div>

          {/* Trial/Status Alert Card */}
          {isTrial && daysLeft > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 border-0 shadow-2xl shadow-emerald-500/20 rounded-[2.5rem] text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <CardContent className="p-8 md:p-10 relative z-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center flex-shrink-0 shadow-inner">
                      <Sparkles className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h2 className="text-3xl font-black mb-3">
                        Teste Gratuito Ativo
                      </h2>
                      <p className="text-xl text-emerald-50/90 mb-6 font-medium">
                        Você tem <span className="text-white font-black underline decoration-2 underline-offset-4">{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</span> restantes para explorar tudo.
                      </p>
                      <div className="bg-black/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 inline-block text-left">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-emerald-200" />
                          <p className="text-sm font-bold text-white leading-tight">
                            Fim do teste em: {format(trialEndDate, "d 'de' MMMM", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {isCanceled && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-amber-500 to-orange-500 border-0 shadow-2xl shadow-amber-500/20 rounded-[2.5rem] text-white overflow-hidden relative">
                <CardContent className="p-8 md:p-10 relative z-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center flex-shrink-0 shadow-inner">
                      <AlertCircle className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h2 className="text-3xl font-black mb-3">Assinatura Cancelada</h2>
                      <p className="text-xl text-amber-50/90 mb-6 font-medium">
                        Sua assinatura foi cancelada. Você ainda tem acesso às funcionalidades premium até {subscription.end_date ? format(new Date(subscription.end_date), "d 'de' MMMM", { locale: ptBR }) : 'o fim do ciclo'}.
                      </p>
                      <Button 
                        onClick={() => window.location.href = createPageUrl('Plans')}
                        className="bg-white text-amber-600 hover:bg-amber-50 font-black rounded-xl h-12 px-8"
                      >
                        REATIVAR AGORA
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {!subscription && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-0 shadow-2xl shadow-slate-900/20 rounded-[2.5rem] text-white overflow-hidden relative">
                <CardContent className="p-8 md:p-10 relative z-10 text-center">
                  <Zap className="w-16 h-16 text-emerald-400 mx-auto mb-6 animate-bounce" />
                  <h2 className="text-3xl font-black mb-3">Você ainda não tem um plano</h2>
                  <p className="text-xl text-slate-400 mb-8 max-w-lg mx-auto">
                    Assine agora para liberar acesso ilimitado a todas as ferramentas e levar sua rotina veterinária para o próximo nível.
                  </p>
                  <Button 
                    onClick={() => handleCheckout(fallbackPlan?.id || 'autonomo', billingPeriod)}
                    disabled={isProcessing || !fallbackPlan}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl h-14 px-12 text-lg shadow-xl shadow-emerald-500/30"
                  >
                    {fallbackPlan ? 'ASSINAR AGORA' : 'PLANOS INDISPONÍVEIS'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Subscription Detail Card */}
          {(isActive || isTrial || isCanceled) && (
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-0 rounded-[2rem] bg-white dark:bg-[#151922] overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center shadow-inner">
                        <Crown className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 leading-tight">DuoVet {currentPlanName}</h3>
                        <Badge className={`border-0 px-3 py-1 text-xs font-black uppercase tracking-widest mt-1 ${
                          isCanceled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isTrial ? 'Período de Teste' : isCanceled ? 'Cancelada' : 'Assinatura Ativa'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-8 border-y border-slate-50 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Cadastro</p>
                      <p className="text-xl font-black text-slate-900 dark:text-slate-50">
                        {createdAt ? format(createdAt, "d 'de' MMM", { locale: ptBR }) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Valor Mensal</p>
                      <p className="text-3xl font-black text-slate-900 dark:text-slate-50">
                        R$ {toSafeNumber(currentPrice).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                        {isTrial ? `Fim do Teste (${daysLeft} dias)` : isCanceled ? 'Acesso até' : 'Próxima Cobrança'}
                      </p>
                      <p className={`text-3xl font-black ${isTrial ? 'text-amber-500' : 'text-slate-900 dark:text-slate-50'}`}>
                        {(isTrial ? trialEndDate : (subscription?.next_billing_date || subscription?.end_date))
                          ? format(new Date(isTrial ? trialEndDate : (subscription?.next_billing_date || subscription?.end_date)), "d 'de' MMM", { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Data da Assinatura</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {subscription?.start_date ? format(new Date(subscription.start_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-'}
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {availablePlans.map((plan) => (
                      <Button 
                        key={plan.id}
                        variant={subscription?.plan === plan.id ? "secondary" : "outline"}
                        className={`rounded-2xl border-slate-200 font-bold h-12 px-4 text-xs ${
                          subscription?.plan === plan.id ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700'
                        }`}
                        onClick={() => handleCheckout(plan.id, billingPeriod)}
                        disabled={subscription?.plan === plan.id || isProcessing}
                      >
                        {isProcessing ? 'Abrindo checkout...' : 
                         subscription?.plan === plan.id ? 'Plano Atual' : `Ir para ${planNames[plan.id]}`}
                      </Button>
                    ))}
                  </div>

                  {!isCanceled && (
                    <div className="mt-6 pt-6 border-t border-slate-50">
                      <Button 
                        variant="ghost" 
                        className="rounded-2xl text-slate-400 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold h-10 px-6 transition-colors text-xs"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja cancelar sua assinatura? Você perderá acesso às funcionalidades premium.')) {
                            cancelSubscriptionMutation.mutate();
                          }
                        }}
                        disabled={cancelSubscriptionMutation.isPending}
                      >
                        {cancelSubscriptionMutation.isPending ? 'Cancelando...' : 'Cancelar Assinatura'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-0 rounded-[2rem] bg-white dark:bg-[#151922] overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {isTrial ? 'Tempo restante do teste' : isCanceled ? 'Acesso restante' : 'Tempo até renovação'}
                        </p>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-50">
                          {countdown.expired ? 'Encerrado' : 'Acompanhamento em tempo real'}
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-center">
                        <div className="text-3xl font-black text-slate-900 dark:text-slate-50">{countdown.days}</div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">dias</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-center">
                        <div className="text-3xl font-black text-slate-900 dark:text-slate-50">{countdown.hours}</div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">horas</div>
                      </div>
                    </div>

                    <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      <span>{usagePercent}% do período utilizado</span>
                      <span>{100 - usagePercent}% restante</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full ${isTrial ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%` }}
                      />
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">
                      {countdownTarget
                        ? `${isTrial ? 'Seu teste termina' : isCanceled ? 'Seu acesso termina' : 'Sua próxima renovação acontece'} em ${format(new Date(countdownTarget), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}.`
                        : 'Ainda não foi possível calcular o próximo marco da sua assinatura.'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-0 rounded-[2rem] bg-white dark:bg-[#151922] overflow-hidden">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                        <HelpCircle className="w-6 h-6 text-slate-700" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ações rápidas</p>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-50">Gerenciar assinatura</h3>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleCheckout(currentPlanId, billingPeriod)}
                      disabled={isProcessing || !plans[currentPlanId]?.active}
                      className="w-full rounded-2xl h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                    >
                      {isProcessing ? 'Abrindo checkout...' : isActive ? 'Atualizar forma de pagamento' : 'Assinar agora'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={openSupportWhatsapp}
                      className="w-full rounded-2xl h-12 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold"
                    >
                      Falar com suporte
                    </Button>
                  </CardContent>
                </Card>
              </div>


            </div>
          )}

          {/* Payment History */}
          {(paymentHistory && paymentHistory.length > 0) && (
            <Card className="shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-0 rounded-[2rem] bg-white dark:bg-[#151922]">
              <CardContent className="p-8">
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-8 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-emerald-600" />
                  Histórico de Pagamentos
                </h3>
                
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm group-hover:scale-110 transition-transform">
                          <CreditCard className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-slate-50 text-lg">
                            R$ {toSafeNumber(payment.amount).toFixed(2).replace('.', ',')}
                          </p>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {payment.date ? format(new Date(payment.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 mb-1 font-black px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest">
                          PAGO
                        </Badge>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{payment.method || 'Cartão'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!paymentHistory || paymentHistory.length === 0 && (subscription) && (
             <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium italic bg-white dark:bg-[#151922] rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
               Nenhum histórico de pagamento disponível ainda.
             </div>
          )}
        </div>
      </div>
    );
  }

  // Landing page - sem assinatura
  const features = [
    { icon: Stethoscope, title: 'Fichas de Campo', desc: 'Atendimentos clínicos, reprodutivos e cirurgias' },
    { icon: Calendar, title: 'Agenda de Visitas', desc: 'Gestão de roteiros e visitas periódicas' },
    { icon: FileText, title: 'Prescrições e Laudos', desc: 'PDFs profissionais com sua logomarca' },
    { icon: TrendingUp, title: 'Controle de Receitas', desc: 'Gestão financeira focada no campo' },
    { icon: Smartphone, title: 'Funciona Offline', desc: 'Registre tudo mesmo sem internet na fazenda' },
    { icon: Users, title: 'Gestão de Rebanho', desc: 'Acompanhe a evolução de cada animal' },
    { icon: PawPrint, title: 'Animais de Produção', desc: 'Bovinos, equinos, ovinos e muito mais' },
    { icon: Shield, title: 'Dados Seguros', desc: 'Backup automático e segurança bancária' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-[#0b0b0f] dark:via-[#111318] dark:to-[#0f1b16] overflow-x-hidden">
      {/* Landing Navigation */}
      {!isAuthenticated && (
        <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 dark:bg-[#10141c]/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 h-16 flex items-center justify-center">
          <div className="max-w-6xl w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
                <img src="/logo.png?v=1" alt="DuoVet Logo" className="w-full h-full object-contain p-1" />
              </div>
              <span className="font-black text-xl text-slate-900 dark:text-slate-50 tracking-tight">Duo<span className="text-emerald-600">Vet</span></span>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <Link 
                to="/privacy" 
                className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-300 hover:text-emerald-600 transition-colors"
              >
                Privacidade
              </Link>
              <Link 
                to="/login" 
                className="text-sm font-bold text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors px-4 py-2"
              >
                Entrar
              </Link>
              <Link 
                to="/register" 
                className="bg-slate-900 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Criar Conta
              </Link>
            </div>
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <section className={`${!isAuthenticated ? 'pt-32' : 'pt-12'} pb-16 md:py-24 px-4 relative overflow-hidden`}>
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-20">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-100 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center w-full px-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-bold mb-8 shadow-sm border border-emerald-200/50 dark:border-emerald-900/50">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              7 dias de teste grátis • Sem compromisso
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-900 dark:text-slate-50 mb-8 leading-[1.1] tracking-tight">
              A ferramenta definitiva para o <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Veterinário de Campo</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
              Gestão clínica, reprodutiva e financeira completa para grandes animais. 
              <strong> Experimente agora e sinta a diferença no seu dia a dia.</strong>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto mb-12">
              <div className="flex items-center gap-3 bg-white/80 dark:bg-[#171c25]/85 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-full">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-50">Segurança Total</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Dados criptografados</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/80 dark:bg-[#171c25]/85 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-full">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-50">Acesso Offline</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Funciona em qualquer lugar</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 px-4 relative">
        <div className="max-w-2xl mx-auto w-full relative z-10">
          <Card className="shadow-[0_20px_50px_rgba(34,197,94,0.15)] border-2 border-emerald-500/20 overflow-hidden bg-white/90 dark:bg-[#151922]/95 dark:border-emerald-900/40 backdrop-blur-md rounded-[2.5rem]">
            <CardContent className="p-8 md:p-12">
              {/* Plan Header */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-2 rounded-full text-sm font-black mb-6 shadow-lg shadow-emerald-500/20">
                  <Crown className="w-4 h-4" />
                  {hasLandingPlan ? `PLANO ${landingPlan.name.toUpperCase()}` : 'PLANOS TEMPORARIAMENTE INDISPONÍVEIS'}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Tudo que você precisa</h2>
                <p className="text-slate-500 dark:text-slate-300 text-sm md:text-base">
                  Acesso ilimitado a todas as funcionalidades
                </p>
              </div>

              {/* Period Toggle */}
              <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] mb-10 max-w-sm mx-auto">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`flex-1 py-3 px-6 rounded-[1.1rem] font-bold text-sm transition-all duration-300 ${
                    billingPeriod === 'monthly' ? 'bg-white dark:bg-[#111827] shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setBillingPeriod('yearly')}
                  className={`flex-1 py-3 px-6 rounded-[1.1rem] font-bold text-sm transition-all duration-300 relative ${
                    billingPeriod === 'yearly' ? 'bg-white dark:bg-[#111827] shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
                  }`}
                >
                  Anual
                  {hasLandingPlan && landingMonthly > 0 && landingYearly > 0 && (
                    <Badge className="absolute -top-2 -right-1 bg-emerald-500 text-white border-0 text-[10px] px-2 shadow-md font-black">
                      -{Math.round((1 - landingYearly / (landingMonthly * 12)) * 100)}%
                    </Badge>
                  )}
                </button>
              </div>

              {/* Price Display */}
              <div className="text-center mb-10">
                <div className="flex items-start justify-center gap-1 mb-2">
                  <span className="text-lg font-bold text-slate-400 mt-2">R$</span>
                  <span className="text-6xl md:text-7xl font-black text-slate-900 dark:text-slate-50 tracking-tighter">
                    {Math.floor(landingCurrentPrice)}
                  </span>
                  <div className="text-left mt-2">
                    <span className="block text-2xl font-bold text-slate-900 dark:text-slate-50">,{(toSafeNumber(landingCurrentPrice) % 1).toFixed(2).substring(2)}</span>
                    <span className="block text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      /{billingPeriod === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </div>
                </div>
                {billingPeriod === 'yearly' && hasLandingPlan && (
                  <p className="text-sm text-emerald-600 font-bold bg-emerald-50 inline-block px-4 py-1 rounded-full">
                    💰 Economia de R$ {(toSafeNumber(landingMonthly) * 12 - toSafeNumber(landingYearly)).toFixed(2).replace('.', ',')}/ano
                  </p>
                )}
              </div>

              {/* Features List (Short) */}
              <div className="space-y-4 mb-10">
                {[
                  'Pacientes e Atendimentos Ilimitados',
                  'Fichas Clínicas e Reprodutivas',
                  'Emissão de Laudos e Receitas',
                  'Gestão Financeira de Campo'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => handleCheckout(landingPlan?.id || 'autonomo', billingPeriod)}
                disabled={isProcessing || !hasLandingPlan}
                className="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-lg font-black rounded-2xl shadow-xl shadow-emerald-500/30 disabled:opacity-60 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] mb-6"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-3" />
                    {hasLandingPlan ? 'ASSINAR COM STRIPE' : 'SEM PLANOS DISPONÍVEIS'}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Seguro
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Criptografado
                </div>
                <div className="flex items-center gap-1">
                  <CreditCard className="w-3 h-3" />
                  Stripe
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-white/50 dark:bg-[#11161f]/60 relative overflow-hidden">
        <div className="max-w-6xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Tudo que o seu dia a dia exige</h2>
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-300 max-w-2xl mx-auto font-medium">
              Desenvolvido por quem entende as necessidades do veterinário de campo.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group"
              >
                <div className="h-full bg-white dark:bg-[#151922] p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-emerald-500/20 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors duration-300">
                    <feature.icon className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">Segurança e Confiança</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 md:gap-6">
            <Card className="text-center shadow-lg border-2 border-gray-100">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Dados protegidos</h3>
                <p className="text-gray-600 dark:text-gray-300">Criptografia de ponta a ponta</p>
              </CardContent>
            </Card>
            <Card className="text-center shadow-lg border-2 border-gray-100">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Pagamento seguro</h3>
                <p className="text-gray-600 dark:text-gray-300">Processado pelo Stripe</p>
              </CardContent>
            </Card>
            <Card className="text-center shadow-lg border-2 border-gray-100">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Cancele fácil</h3>
                <p className="text-gray-600 dark:text-gray-300">Sem complicações</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      {!isAuthenticated && (
        <footer className="bg-white border-t border-slate-100 py-12 px-4">
          <div className="max-w-6xl mx-auto w-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
                    <img src="/logo.png?v=1" alt="DuoVet Logo" className="w-full h-full object-contain p-1" />
                  </div>
                  <span className="font-black text-xl text-slate-900 tracking-tight">Duo<span className="text-emerald-600">Vet</span></span>
                </div>
                <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                  A ferramenta definitiva para o Veterinário de Campo. Gestão clínica, reprodutiva e financeira completa para grandes animais.
                </p>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Legal</h4>
                <ul className="space-y-2">
                  <li>
                    <Link to="/privacy" className="text-slate-500 hover:text-emerald-600 text-sm transition-colors">
                      Política de Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link to="/termos" className="text-slate-500 hover:text-emerald-600 text-sm transition-colors">
                      Termos de Uso
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Suporte</h4>
                <ul className="space-y-2">
                  <li>
                    <button 
                      onClick={() => setIsSupportModalOpen(true)}
                      className="text-slate-500 hover:text-emerald-600 text-sm transition-colors flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Falar com Suporte
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-slate-400 text-xs">
                © {new Date().getFullYear()} DuoVet. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-6">
                <Shield className="w-4 h-4 text-slate-300" />
                <Lock className="w-4 h-4 text-slate-300" />
                <CreditCard className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSupportModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden border border-slate-100"
          >
            <div className="p-8 md:p-10">
              <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <button 
                  onClick={() => setIsSupportModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Como podemos ajudar?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed font-medium">
                Nossa equipe de suporte está pronta para te auxiliar com planos, cobrança e ativação. Escolha o canal de atendimento abaixo.
              </p>
              
              <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                <div className="flex items-center gap-3 mb-1">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">{supportEmail}</span>
                </div>
                <p className="text-xs text-slate-500 ml-7">Tempo médio de resposta: 24h</p>
              </div>

              <div className="space-y-3">
                {supportWhatsapp ? (
                  <button
                    type="button"
                    onClick={openSupportWhatsapp}
                    className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-3"
                  >
                    <HelpCircle className="w-5 h-5" />
                    Falar no WhatsApp
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openSupportEmail}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-3"
                >
                  <Mail className="w-5 h-5" />
                  Enviar E-mail Agora
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
