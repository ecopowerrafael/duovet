import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se já existe subscription para este usuário
    const existingSubscriptions = await base44.asServiceRole.entities.Subscription.filter({
      user_id: user.id
    });

    if (existingSubscriptions.length > 0) {
      return Response.json({
        message: 'User already has a subscription',
        subscription: existingSubscriptions[0]
      });
    }

    // Criar trial de 7 dias automaticamente
    const today = new Date();
    const trialEndDate = new Date(today);
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const subscription = await base44.asServiceRole.entities.Subscription.create({
      user_id: user.id,
      plan: 'trial',
      status: 'trial',
      trial_start_date: today.toISOString().split('T')[0],
      trial_end_date: trialEndDate.toISOString().split('T')[0],
      amount: 0,
      billing_period: 'monthly'
    });

    return Response.json({
      message: 'Trial created successfully',
      subscription,
      trial_days: 7
    });
  } catch (error) {
    console.error('Error initializing user:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});