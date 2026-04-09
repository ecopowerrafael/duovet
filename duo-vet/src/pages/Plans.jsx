import React, { useState } from 'react';
// Base44 removido: substituído por mocks/local logic
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Check, User, Users, Building2, Shield, Clock, CreditCard, HeadphonesIcon, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, getAuthTokenAsync, isOnline, offlineFetch } from '../lib/offline';
import { getGlobalSettings } from '../lib/api';

export default function Plans() {
  const [loading, setLoading] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('yearly'); // Anual pré-selecionado para ancoragem

  const { data: settings } = useQuery({
    queryKey: ['global-settings'],
    queryFn: getGlobalSettings
  });

  const parseSettingNumber = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const isSettingTrue = (value) => String(value).toLowerCase() === 'true';

  const PLANS = [
    {
      id: 'autonomo',
      name: 'Autônomo',
      subtitle: '1 usuário',
      monthlyPrice: parseSettingNumber(settings?.planAutonomoMonthly ?? settings?.planMonthly, 89.9),
      yearlyPrice: parseSettingNumber(settings?.planAutonomoYearly ?? settings?.planYearly, 899),
      active: settings ? isSettingTrue(settings.planAutonomoActive) : true,
      icon: User,
      color: 'emerald',
      features: [
        '1 usuário',
        'Atendimentos clínicos, reprodutivos e consultorias',
        'Prescrições automáticas em PDF',
        'Relatórios profissionais',
        'Envio por WhatsApp',
        'Agenda integrada ao Google',
        'Financeiro básico',
        'Chave Pix no relatório',
        'Modo claro e dark',
      ],
    },
    {
      id: 'profissional',
      name: 'Profissional',
      subtitle: 'Até 5 usuários',
      monthlyPrice: parseSettingNumber(
        settings?.planProfissionalMonthly ?? (settings?.planMonthly ? Number(String(settings.planMonthly).replace(',', '.')) * 3.2 : undefined),
        289.9
      ),
      yearlyPrice: parseSettingNumber(
        settings?.planProfissionalYearly ?? (settings?.planYearly ? Number(String(settings.planYearly).replace(',', '.')) * 3.2 : undefined),
        2899
      ),
      active: settings ? isSettingTrue(settings.planProfissionalActive) : true,
      icon: Users,
      color: 'blue',
      popular: true,
      features: [
        'Tudo do Autônomo',
        'Até 5 usuários simultâneos',
        'Dashboard com indicadores',
        'Relatórios avançados',
        'Consultorias com cobrança recorrente',
        'Histórico técnico por propriedade',
        'Exportação financeira',
        'Suporte prioritário',
      ],
    },
    {
      id: 'empresarial',
      name: 'Empresarial',
      subtitle: 'Até 20 usuários',
      monthlyPrice: parseSettingNumber(
        settings?.planEmpresarialMonthly ?? (settings?.planMonthly ? Number(String(settings.planMonthly).replace(',', '.')) * 11 : undefined),
        989.9
      ),
      yearlyPrice: parseSettingNumber(
        settings?.planEmpresarialYearly ?? (settings?.planYearly ? Number(String(settings.planYearly).replace(',', '.')) * 11 : undefined),
        9899
      ),
      active: settings ? isSettingTrue(settings.planEmpresarialActive) : true,
      icon: Building2,
      color: 'purple',
      features: [
        'Tudo do Profissional',
        'Até 20 usuários simultâneos',
        'Gestão de permissões',
        'Relatórios financeiros completos',
        'Emissão de nota fiscal integrada',
        'Marca personalizada nos relatórios',
        'Logs e auditoria',
        'Backup avançado',
        'Suporte premium',
      ],
    },
  ].filter((plan) => plan.active);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const subs = await offlineFetch('/api/subscriptions');
      return subs && subs.length > 0 ? subs[0] : null;
    },
    enabled: !!user?.id,
  });

  const handleSubscribe = async (plan) => {
    setLoading(plan.id);
    try {
      if (!isOnline()) {
        toast.error('Você precisa estar online para assinar');
        return;
      }
      if (!user?.id || !user?.email) {
        toast.error('Faça login para assinar');
        return;
      }

      const token = await getAuthTokenAsync();
      if (!token) {
        toast.error('Sua sessão expirou. Faça login novamente para assinar.');
        return;
      }

      const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
      const priceCents = Math.round(amount * 100);
      const response = await apiFetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          plan_id: plan.id,
          billing_period: billingPeriod,
          price_cents: priceCents
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Não foi possível iniciar o checkout');
      }

      toast.success('Redirecionando para o Stripe...');
      window.location.href = data.url;
    } catch (error) {
      toast.error(error.message || 'Erro ao processar assinatura. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  const colorClasses = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-pink-600',
  };

  const getDisplayPrice = (plan) => {
    if (billingPeriod === 'yearly') {
      const monthlyEquivalent = plan.yearlyPrice / 12;
      return {
        total: plan.yearlyPrice,
        monthly: monthlyEquivalent,
        isYearly: true
      };
    }
    return {
      total: plan.monthlyPrice,
      monthly: plan.monthlyPrice,
      isYearly: false
    };
  };

  return (
    <div className="min-h-screen py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
              <img 
                src="/logo.png?v=1"
                alt="DuoVet" 
                className="w-full h-full object-contain p-1"
              />
            </div>
            <span className="font-bold text-3xl text-gray-900">
              Duo<span className="text-[#22c55e]">Vet</span>
            </span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-3 text-[var(--text-primary)]">
            Escolha o plano ideal para sua rotina veterinária
          </h1>
          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
            Organize atendimentos, prescrições, relatórios e financeiro em um só lugar.
          </p>

          {/* Trial Badge */}
          <div className="inline-flex items-center gap-6 bg-gradient-to-r from-[#22c55e]/10 to-emerald-500/10 border-2 border-[#22c55e]/30 rounded-2xl px-6 py-4 mb-8">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#22c55e]" />
              <span className="font-bold text-[var(--text-primary)]">7 dias grátis</span>
            </div>
            <div className="h-8 w-px bg-[var(--border-color)]" />
            <span className="text-sm text-[var(--text-secondary)]">Acesso completo por 7 dias</span>
            <div className="h-8 w-px bg-[var(--border-color)]" />
            <span className="text-sm text-[var(--text-secondary)]">Sem cobrança durante o período</span>
            <div className="h-8 w-px bg-[var(--border-color)]" />
            <span className="text-sm text-[var(--text-secondary)]">Cancelamento a qualquer momento</span>
          </div>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-[var(--accent)] text-white shadow-lg'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all relative ${
              billingPeriod === 'yearly'
                ? 'bg-[var(--accent)] text-white shadow-lg'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            Anual
            <Badge className="ml-2 bg-amber-500 text-white text-xs">
              Economize 20%
            </Badge>
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
          {PLANS.length === 0 ? (
            <Card className="md:col-span-3 text-center border border-[var(--border-color)] bg-[var(--bg-card)]">
              <CardContent className="p-10">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Planos indisponíveis</h3>
                <p className="text-[var(--text-secondary)]">Nenhum plano está ativo no momento. Tente novamente mais tarde.</p>
              </CardContent>
            </Card>
          ) : PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = subscription?.plan === plan.id && subscription?.status === 'active';
            const displayPrice = getDisplayPrice(plan);
            
            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 ${
                  plan.popular
                    ? 'border-3 border-[#22c55e] shadow-2xl md:scale-105 bg-[var(--bg-card)] ring-2 ring-[#22c55e]/20'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] hover:shadow-xl'
                }`}
              >
                {plan.popular && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#22c55e] to-emerald-600" />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 text-sm font-bold shadow-lg">
                        ⭐ Mais Escolhido
                      </Badge>
                    </div>
                  </>
                )}
                
                <CardHeader className="text-center pb-6 pt-10">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${colorClasses[plan.color]} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <CardTitle className="text-2xl md:text-3xl mb-2 text-[var(--text-primary)] font-bold">{plan.name}</CardTitle>
                  <p className="text-sm text-[var(--text-muted)] font-medium">{plan.subtitle}</p>
                  
                  <div className="mt-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl md:text-5xl font-bold text-[var(--text-primary)]">
                        R$ {displayPrice.monthly.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[var(--text-muted)] text-lg">/mês</span>
                    </div>
                    {displayPrice.isYearly && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-[var(--text-muted)]">
                          Total anual: R$ {displayPrice.total.toFixed(2).replace('.', ',')}
                        </p>
                        <Badge variant="outline" className="text-[#22c55e] border-[#22c55e] text-xs">
                          Equivalente a 2 meses grátis
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pb-8">
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={loading === plan.id || isCurrentPlan}
                    className={`w-full h-12 text-base font-bold rounded-xl transition-all ${
                      plan.popular
                        ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg hover:shadow-xl'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[#22c55e] hover:text-white text-[var(--text-primary)]'
                    }`}
                  >
                    {loading === plan.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                      </div>
                    ) : isCurrentPlan ? (
                      'Plano Atual'
                    ) : plan.id === 'empresarial' ? (
                      'Assinar agora'
                    ) : (
                      'Assinar agora'
                    )}
                  </Button>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust & Security Section */}
        <Card className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-tertiary)] border border-[var(--border-color)] shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl text-[var(--text-primary)] mb-2">
              Confiança e Segurança
            </CardTitle>
            <p className="text-[var(--text-secondary)]">
              Transparência total para você contratar com tranquilidade
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center text-center p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-[#22c55e]" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-2">Dados Seguros</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Criptografia de ponta a ponta e servidores seguros
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-4">
                  <CreditCard className="w-7 h-7 text-[#22c55e]" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-2">Cancelamento Simples</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Sem burocracias. Cancele diretamente pela plataforma
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-[#22c55e]" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-2">Sem Fidelidade</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Cobrança mensal ou anual. Sem contratos de longo prazo
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-4">
                  <HeadphonesIcon className="w-7 h-7 text-[#22c55e]" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] mb-2">Suporte Humano</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Equipe real pronta para te ajudar quando precisar
                </p>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-center gap-8 flex-wrap text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#22c55e]" strokeWidth={3} />
                  <span className="text-sm font-medium">Pagamentos via Stripe</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#22c55e]" strokeWidth={3} />
                  <span className="text-sm font-medium">SSL Certificado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#22c55e]" strokeWidth={3} />
                  <span className="text-sm font-medium">LGPD Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#22c55e]" strokeWidth={3} />
                  <span className="text-sm font-medium">Upgrade/Downgrade Flexível</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
