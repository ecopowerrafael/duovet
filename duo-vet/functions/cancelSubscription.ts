import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const [subscription] = await base44.entities.Subscription.filter({ user_id: user.id });

    if (!subscription || !subscription.stripe_subscription_id) {
      return Response.json({ error: 'Assinatura não encontrada' }, { status: 404 });
    }

    // Cancel at period end (not immediately)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await base44.entities.Subscription.update(subscription.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });

    return Response.json({ 
      success: true,
      message: 'Assinatura cancelada. Você manterá acesso até o fim do período pago.' 
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return Response.json({ 
      error: 'Erro ao cancelar assinatura',
      details: error.message 
    }, { status: 500 });
  }
});