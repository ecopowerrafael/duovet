import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AlertTriangle, CreditCard, Clock, Shield } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function SubscriptionRequired({ reason, message, trialEndDate, organization }) {
  const isTrialExpired = reason === 'trial_expired';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <Card className="max-w-2xl w-full bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl">
        <CardHeader className="text-center pb-8 pt-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-white" />
          </div>
          
          <CardTitle className="text-3xl mb-3 text-[var(--text-primary)]">
            {isTrialExpired ? 'Período de Teste Finalizado' : 'Assinatura Necessária'}
          </CardTitle>
          
          <p className="text-[var(--text-secondary)] text-lg">
            {message || 'Para continuar usando o DuoVet, escolha um plano.'}
          </p>
        </CardHeader>

        <CardContent className="space-y-6 pb-12">
          {isTrialExpired && trialEndDate && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Seu teste gratuito de 7 dias encerrou
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Período: até {new Date(trialEndDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <CreditCard className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">
                  Escolha um plano e continue
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Planos a partir de R$ 49,90/mês. Cancele quando quiser.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <Shield className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">
                  Seus dados estão seguros
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Todas as suas informações permaneceram salvas e serão restauradas após a assinatura.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-3">
            <Button
              onClick={() => window.location.href = createPageUrl('Plans')}
              className="w-full h-14 text-lg font-bold bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl shadow-lg"
            >
              Ver Planos e Assinar
            </Button>

            <Button
              onClick={() => window.location.href = createPageUrl('Settings')}
              variant="outline"
              className="w-full rounded-xl"
            >
              Ir para Configurações
            </Button>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-[var(--text-muted)]">
              Precisa de ajuda? <a href="mailto:suporte@duovet.com" className="text-[#22c55e] hover:underline">Entre em contato</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}