import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Hook para verificar se está expirado
export function useSubscriptionStatus() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: organization } = useQuery({
    queryKey: ['organization', user?.email],
    queryFn: async () => {
      const orgs = await base44.entities.Organization.filter({ owner_id: user.id });
      return orgs[0] || null;
    },
    enabled: !!user?.id,
  });

  const status = organization?.subscription_status || 'trial';
  const isExpired = ['expired', 'cancelled'].includes(status);
  const isTrial = status === 'trial';
  const isActive = status === 'active';
  
  // Verificar se o trial expirou (fallback caso o webhook não tenha atualizado)
  const trialEndDate = organization?.trial_end_date ? new Date(organization.trial_end_date) : null;
  const today = new Date();
  const trialHasExpired = trialEndDate && today > trialEndDate;

  return {
    isExpired: isExpired || (isTrial && trialHasExpired),
    canCreate: !isExpired && !trialHasExpired,
    canView: true, // Sempre pode visualizar (modo leitura)
    isTrial,
    isActive,
  };
}

// Mini modal contextual para bloqueios
export function SubscriptionBlockerModal({ isOpen, onClose, feature = 'este recurso' }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md"
        >
          <Card className="bg-white shadow-2xl border-0 rounded-2xl overflow-hidden">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-orange-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  🔐 Recurso disponível após a assinatura
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Continue usando o DuoVet sem interrupções.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => window.location.href = createPageUrl('MySubscription')}
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Assinar agora
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  className="w-full text-gray-600"
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Função helper para checar e bloquear se necessário
export function checkSubscriptionAndBlock(isExpired, feature = 'esta ação') {
  if (isExpired) {
    toast.error(`${feature} está disponível apenas para assinantes`, {
      action: {
        label: 'Assinar',
        onClick: () => window.location.href = createPageUrl('MySubscription'),
      },
    });
    return true; // Bloqueado
  }
  return false; // Permitido
}