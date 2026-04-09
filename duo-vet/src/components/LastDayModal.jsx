import React, { useState, useEffect } from 'react';
import { base44 } from '../api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { AlertCircle, CreditCard, CheckCircle } from 'lucide-react';
import { createPageUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function LastDayModal() {
  const [isVisible, setIsVisible] = useState(false);

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
  });

  useEffect(() => {
    if (!subscription || subscription.status !== 'trialing') return;

    const trialEndDate = new Date(subscription.trial_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    trialEndDate.setHours(0, 0, 0, 0);
    
    const daysLeft = Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24));
    
    // Mostrar apenas quando faltam 2 dias ou menos
    if (daysLeft > 2) return;

    const lastShown = localStorage.getItem('lastDayModalShown');
    const todayStr = today.toDateString();

    if (lastShown !== todayStr) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        localStorage.setItem('lastDayModalShown', todayStr);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [subscription]);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || !subscription) return null;

  const trialEndDate = new Date(subscription.trial_end_date);
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24)));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring" }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
        >
          <Card className="bg-white shadow-2xl border-2 border-orange-200 rounded-3xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                <AlertCircle className="w-10 h-10 text-orange-600" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {daysLeft === 0 ? '🔔 Último dia de teste' : `⚠️ Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Seu teste gratúito termina em <strong>{format(trialEndDate, "d 'de' MMMM", { locale: ptBR })}</strong>
                </p>
                <p className="text-base text-gray-600 dark:text-gray-300">
                  Sua assinatura será ativada automaticamente. Não haverá interrupções no seu acesso.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-5 space-y-2.5 border border-blue-100 dark:border-blue-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  💳 O que acontece agora?
                </p>
                <div className="text-left text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Seu cartão será cobrado após o término do teste</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Seu acesso continua sem interrupções</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Cancele a qualquer momento pela página de assinatura</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => window.location.href = createPageUrl('MySubscription')}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-bold rounded-2xl shadow-lg"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Gerenciar assinatura
                </Button>
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  className="w-full text-gray-600 hover:text-gray-900"
                >
                  Entendi
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}