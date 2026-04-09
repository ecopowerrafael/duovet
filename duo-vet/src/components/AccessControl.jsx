import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '../api/base44Client';
import { useAuth } from '../lib/AuthContextJWT';

export default function AccessControl({ children }) {
  const { user } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const [sub] = await base44.entities.Subscription.filter({ user_id: user.id });
      return sub;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Durante o trial ou assinatura ativa, permitir acesso total
  // Stripe gerencia o trial - status 'trialing' ou 'active' permitem acesso
  const hasAccess = subscription && ['trialing', 'active'].includes(subscription.status);

  // Se não tem acesso e não está na página de assinatura, redirecionar
  React.useEffect(() => {
    if (subscription && !hasAccess) {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('MySubscription')) {
        window.location.href = '/MySubscription';
      }
    }
  }, [subscription, hasAccess]);

  return <>{children}</>;
}