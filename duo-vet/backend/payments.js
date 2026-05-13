// Stripe checkout endpoint
const express = require('express');
const router = express.Router();
const stripeLib = require('stripe');
const db = require('./db');
const { authMiddleware } = require('./auth');

const Joi = require('joi');
const DEFAULT_STRIPE_MONTHLY_PRODUCT_ID = 'prod_UAoJfiOqTgkAmg';
const DEFAULT_STRIPE_YEARLY_PRODUCT_ID = 'prod_UAoK3v1S7pxo1J';
const checkoutSchema = Joi.object({
  user_id: Joi.number().integer().required(),
  price_cents: Joi.number().integer().min(1).optional(),
  email: Joi.string().email().required(),
  plan_id: Joi.string().valid('autonomo', 'profissional', 'empresarial').required(),
  billing_period: Joi.string().valid('monthly', 'yearly').required()
});

function isValidStripeSecretKey(key) {
  return /^sk_(test|live)_/.test(String(key || '').trim());
}

function isValidStripeProductId(productId) {
  return /^prod_[A-Za-z0-9]+$/.test(String(productId || '').trim());
}

async function getStripeSecretKey() {
  const result = await db.query(
    `SELECT value FROM settings 
     WHERE (LOWER(key) = LOWER($1) OR LOWER(key) = LOWER($2)) 
     AND user_id IS NULL 
     LIMIT 1`,
    ['STRIPE_SECRET_KEY', 'stripeSecretKey']
  );
  if (result.rows.length === 0) {
    throw new Error('Stripe Secret Key não configurada');
  }
  const secret = String(result.rows[0].value || '').trim();
  if (!isValidStripeSecretKey(secret)) {
    throw new Error('Chave Stripe inválida. Use a Secret Key iniciando com sk_test_ ou sk_live_.');
  }
  return secret;
}

async function getStripeProductIds() {
  const result = await db.query(
    `SELECT key, value FROM settings
     WHERE user_id IS NULL
     AND LOWER(key) = ANY($1::text[])`,
    [[
      'stripemonthlyproductid',
      'stripeyearlyproductid',
      'stripe_monthly_product_id',
      'stripe_yearly_product_id'
    ]]
  );

  const map = {};
  for (const row of result.rows) {
    map[String(row.key || '').toLowerCase()] = String(row.value || '').trim();
  }

  const monthly = map.stripemonthlyproductid || map.stripe_monthly_product_id || DEFAULT_STRIPE_MONTHLY_PRODUCT_ID;
  const yearly = map.stripeyearlyproductid || map.stripe_yearly_product_id || DEFAULT_STRIPE_YEARLY_PRODUCT_ID;

  if (!isValidStripeProductId(monthly)) {
    throw new Error('Produto Stripe mensal inválido. Use um ID iniciando com prod_.');
  }
  if (!isValidStripeProductId(yearly)) {
    throw new Error('Produto Stripe anual inválido. Use um ID iniciando com prod_.');
  }

  return { monthly, yearly };
}
// Criar sessão de pagamento Stripe
router.post('/stripe/checkout', authMiddleware, async (req, res, next) => {
  const { error } = checkoutSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { user_id, price_cents, email, plan_id, billing_period } = req.body;
  try {
    if (req.user.email !== 'admin@duovet.app' && Number(req.user.id) !== Number(user_id)) {
      return res.status(403).json({ error: 'Acesso negado para este usuário.' });
    }
    const stripeSecret = await getStripeSecretKey();
    const stripeProducts = await getStripeProductIds();
    const stripe = stripeLib(stripeSecret);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const normalizedFrontendUrl = String(frontendUrl).replace(/\/$/, '');
    const interval = billing_period === 'yearly' ? 'year' : 'month';
    const stripeProductId = billing_period === 'yearly' ? stripeProducts.yearly : stripeProducts.monthly;

    // Buscar prices existentes do produto no Stripe
    console.log(`[CHECKOUT] Buscando prices do produto ${stripeProductId} (intervalo: ${interval})`);
    const prices = await stripe.prices.list({ product: stripeProductId, active: true, limit: 10 });
    const matchingPrice = prices.data
      .filter(p => p.type === 'recurring')
      .find(p => p.recurring?.interval === interval);
    const selectedPrice = matchingPrice || prices.data.find(p => p.type === 'recurring');
    if (!selectedPrice) {
      return res.status(400).json({
        error: `Nenhum preço ativo encontrado no produto ${stripeProductId}. Configure um preço recorrente no painel Stripe.`
      });
    }
    console.log(`[CHECKOUT] Usando price ${selectedPrice.id} para produto ${stripeProductId}`);

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: selectedPrice.id,
          quantity: 1,
        },
      ],
      metadata: {
        user_id: String(user_id),
        plan_id,
        billing_period,
        price_cents: String(price_cents),
        stripe_product_id: stripeProductId
      },
      subscription_data: {
        metadata: {
          user_id: String(user_id),
          plan_id,
          billing_period
        }
      },
      success_url: `${normalizedFrontendUrl}/my-subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${normalizedFrontendUrl}/my-subscription?canceled=true`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[CHECKOUT] Error:', err.message);
    if (
      String(err.message || '').includes('Chave Stripe inválida') ||
      String(err.message || '').includes('Stripe Secret Key não configurada') ||
      String(err.message || '').includes('Produto Stripe')
    ) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Erro ao criar sessão de pagamento' });
  }
});
// Rotas de pagamentos

// Listar todos os pagamentos
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by, client_id, appointment_id } = req.query;
    let query = 'SELECT * FROM payments';
    const params = [];
    const whereClauses = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      params.push(req.user.email);
      whereClauses.push(`LOWER(created_by) = LOWER($${params.length})`);
    } else if (created_by && created_by !== 'undefined') {
      params.push(created_by);
      whereClauses.push(`LOWER(created_by) = LOWER($${params.length})`);
    }

    const clientIdValue = client_id ? parseInt(client_id) : null;
    if (clientIdValue && Number.isFinite(clientIdValue)) {
      params.push(clientIdValue);
      whereClauses.push(`client_id = $${params.length}`);
    }

    const appointmentIdValue = appointment_id ? parseInt(appointment_id) : null;
    if (appointmentIdValue && Number.isFinite(appointmentIdValue)) {
      params.push(appointmentIdValue);
      whereClauses.push(`appointment_id = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter pagamento por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM payments WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo pagamento
router.post('/', authMiddleware, async (req, res, next) => {
  const { client_id, amount, date, method, status, amount_paid, due_date, payment_date, appointment_id } = req.body;
  const created_by = req.user.email;
  try {
    const result = await db.query(
      `INSERT INTO payments (
        client_id, amount, date, method, status, created_by, 
        amount_paid, due_date, payment_date, appointment_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
      [client_id, amount, date, method, status || 'pending', created_by, amount_paid, due_date, payment_date, appointment_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar pagamento
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  const allowedFields = ['client_id', 'amount', 'date', 'method', 'status', 'amount_paid', 'due_date', 'payment_date', 'appointment_id'];
  
  const fields = [];
  const values = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      values.push(updates[field]);
      idx++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  let query = `UPDATE payments SET ${fields.join(', ')} WHERE id = $${idx}`;
  
  if (req.user && req.user.email !== 'admin@duovet.app') {
    idx++;
    query += ` AND LOWER(created_by) = LOWER($${idx})`;
    values.push(req.user.email);
  }

  query += ' RETURNING *';

  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar pagamento
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM payments WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pagamento não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


// Webhook Stripe para ativar usuário após pagamento
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('[WEBHOOK] Stripe webhook received');
    const stripeSecret = await getStripeSecretKey();
    const stripe = require('stripe')(stripeSecret);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = req.headers['stripe-signature'];
    
    console.log('[WEBHOOK] Endpoint secret configured:', !!endpointSecret);
    console.log('[WEBHOOK] Signature header:', !!sig);
    console.log('[WEBHOOK] Body type:', typeof req.body);
    console.log('[WEBHOOK] Body is Buffer:', Buffer.isBuffer(req.body));
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log('[WEBHOOK] Event verified successfully:', event.type);
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log('[WEBHOOK] Event type:', event.type);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata && session.metadata.user_id;
      console.log('[WEBHOOK] Checkout session completed for user:', userId);
      
      if (userId) {
        try {
          const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
          const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
          const planId = session.metadata?.plan_id || 'profissional';
          const billingPeriod = session.metadata?.billing_period || 'monthly';
          const amount = Number(session.metadata?.price_cents || 0) / 100;
          let nextBillingDate = null;

          if (stripeSubscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (stripeSubscription?.current_period_end) {
              nextBillingDate = new Date(stripeSubscription.current_period_end * 1000);
            }
          }

          await db.query('UPDATE users SET status = $1 WHERE id = $2', ['active', userId]);
          console.log('[WEBHOOK] User activated:', userId);

          const ownerResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
          const ownerEmail = ownerResult.rows[0]?.email || null;
          const existing = await db.query(
            `SELECT id FROM subscriptions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [userId]
          );

          if (existing.rows.length > 0) {
            await db.query(
              `UPDATE subscriptions
               SET status = $1,
                   start_date = COALESCE(start_date, NOW()),
                   end_date = $2,
                   next_billing_date = $2,
                   plan = $3,
                   billing_period = $4,
                   amount = $5,
                   stripe_subscription_id = $6,
                   stripe_customer_id = $7,
                   created_by = COALESCE(created_by, $8)
               WHERE id = $9`,
              ['active', nextBillingDate, planId, billingPeriod, amount, stripeSubscriptionId, stripeCustomerId, ownerEmail, existing.rows[0].id]
            );
            console.log('[WEBHOOK] Subscription updated:', existing.rows[0].id, 'Plan:', planId, 'Period:', billingPeriod);
          } else {
            await db.query(
              `INSERT INTO subscriptions (
                user_id, start_date, end_date, status, created_by, created_at,
                plan, billing_period, amount, next_billing_date,
                stripe_subscription_id, stripe_customer_id
              ) VALUES ($1, NOW(), $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10)`,
              [userId, nextBillingDate, 'active', ownerEmail, planId, billingPeriod, amount, nextBillingDate, stripeSubscriptionId, stripeCustomerId]
            );
            console.log('[WEBHOOK] Subscription created for user:', userId, 'Plan:', planId, 'Period:', billingPeriod);
          }
        } catch (err) {
          console.error('[WEBHOOK] Error activating user:', err.message);
          return res.status(500).send('Erro ao ativar usuário');
        }
      }
    } else {
      console.log('[WEBHOOK] Ignoring event type:', event.type);
    }
    console.log('[WEBHOOK] Webhook processed successfully');
    return res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    if (
      String(err.message || '').includes('Chave Stripe inválida') ||
      String(err.message || '').includes('Stripe Secret Key não configurada') ||
      String(err.message || '').includes('Produto Stripe')
    ) {
      return res.status(400).send(err.message);
    }
    return res.status(500).send('Erro ao buscar chave Stripe');
  }
});

// Obter invoices de assinatura do usuário
router.get('/subscriptions/invoices', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Buscar a assinatura ativa do usuário
    const subResult = await db.query(
      `SELECT stripe_subscription_id, stripe_customer_id 
       FROM subscriptions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (!subResult.rows.length || !subResult.rows[0].stripe_customer_id) {
      return res.json([]);
    }
    
    const stripeSecret = await getStripeSecretKey();
    const stripe = stripeLib(stripeSecret);
    const customerId = subResult.rows[0].stripe_customer_id;
    
    // Buscar invoices do Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      status: 'paid'
    });
    
    // Formatar invoices para o frontend
    const formattedInvoices = (invoices.data || []).map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100,
      date: new Date(invoice.created * 1000).toISOString(),
      method: 'Cartão',
      status: 'pago',
      invoice_pdf: invoice.invoice_pdf
    }));
    
    res.json(formattedInvoices);
  } catch (err) {
    console.error('Erro ao buscar invoices:', err);
    res.json([]);
  }
});

module.exports = router;
