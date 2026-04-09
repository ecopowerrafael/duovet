import React from 'react';
import { useAuth } from '../lib/AuthContextJWT';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';

export default function TrialExpiredOverlay() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Se não tem usuário, não bloqueia (deixa o login lidar)
  if (!user) return null;

  // Bloquear se status é 'expired'
  const shouldBlock = user.status === 'expired';
  
  // Permitir acesso à página de assinatura
  const currentPath = String(window.location.pathname || '').toLowerCase();
  const allowPaths = ['/my-subscription', '/login', '/register', '/reset-password', '/auth-callback'];
  if (allowPaths.some((path) => currentPath.startsWith(path))) return null;

  if (!shouldBlock) return null;

  const goToSubscription = () => {
    setLoading(true);
    window.location.assign('/my-subscription');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-xl z-[9999] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lock className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Seu teste gratúito expirou
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Assine para continuar usando o DuoVet
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 mb-6 border border-green-100 dark:border-green-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              ✨ Continue com o DuoVet:
            </p>
            <ul className="text-left text-sm text-gray-700 dark:text-gray-300 space-y-2.5">
              {[
                'Atendimentos ilimitados',
                'Relatórios profissionais',
                'Controle financeiro completo',
                'Suporte prioritário'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 text-base font-semibold shadow-lg"
            onClick={goToSubscription}
            disabled={loading}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            {loading ? 'Abrindo...' : 'Ir para Assinatura'}
          </Button>

          <p className="text-xs text-gray-500 mt-4">
            🔒 Pagamento 100% seguro via Stripe
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
