import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TrialBanner() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const [sub] = await base44.entities.Subscription.filter({ user_id: user.id });
      return sub || null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const daysLeft = React.useMemo(() => {
    if (!subscription || subscription.status !== 'trialing') return 0;
    
    const trialEndDate = new Date(subscription.trial_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    trialEndDate.setHours(0, 0, 0, 0);
    
    return Math.max(0, Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  if (!subscription || subscription.status !== 'trialing' || daysLeft < 0) {
    return null;
  }

  const trialEndDate = new Date(subscription.trial_end_date);
  const isUrgent = daysLeft <= 5;
  const isCritical = daysLeft <= 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`border-b shadow-sm ${
          isCritical
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
            : isUrgent
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCritical
                  ? 'bg-red-100'
                  : isUrgent
                    ? 'bg-amber-100'
                    : 'bg-blue-100'
              }`}>
                {isCritical ? (
                  <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
                ) : isUrgent ? (
                  <Clock className="w-5 h-5 text-amber-600" />
                ) : (
                  <Sparkles className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className={`text-sm font-bold ${
                  isCritical
                    ? 'text-red-900'
                    : isUrgent
                      ? 'text-amber-900'
                      : 'text-blue-900'
                }`}>
                  {isCritical
                    ? `⚠️ Teste termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`
                    : isUrgent
                      ? `⏳ Faltam ${daysLeft} dias para o fim do teste`
                      : `✨ Você está em teste gratuito • ${daysLeft} dias restantes`}
                </p>
                <p className="text-xs text-gray-600">
                  {isCritical
                    ? 'Evite interrupções, sua assinatura será ativada automaticamente'
                    : isUrgent
                      ? `Primeira cobrança em ${format(trialEndDate, "d 'de' MMMM", { locale: ptBR })}`
                      : 'Sem cobrança até o fim do teste • Cancele quando quiser'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.location.href = createPageUrl('MySubscription')}
              size="sm"
              className={`font-semibold rounded-lg shadow-md whitespace-nowrap ${
                isCritical || isUrgent
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200'
              }`}
            >
              Gerenciar assinatura
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}