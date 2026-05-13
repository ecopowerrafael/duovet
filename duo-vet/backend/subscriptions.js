// Rotas de assinaturas
const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Conexão com PostgreSQL
const db = require('./db');
const isAdmin = (req) => req.user && req.user.email === 'admin@duovet.app';

// Listar todas as assinaturas
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by, user_id } = req.query;
    let query = 'SELECT * FROM subscriptions';
    const params = [];
    const conditions = [];

    if (!isAdmin(req)) {
      params.push(req.user.id);
      conditions.push(`user_id = $${params.length}`);
    } else {
      if (user_id && user_id !== 'undefined' && user_id !== 'null' && user_id !== '') {
        params.push(parseInt(user_id, 10));
        conditions.push(`user_id = $${params.length}`);
      }
      if (created_by && created_by !== 'undefined' && created_by !== 'null' && created_by !== '') {
        params.push(created_by);
        conditions.push(`LOWER(created_by) = LOWER($${params.length})`);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter assinatura por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM subscriptions WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assinatura não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar nova assinatura
router.post('/', authMiddleware, async (req, res, next) => {
  const {
    user_id,
    start_date,
    end_date,
    status,
    plan,
    billing_period,
    amount,
    trial_end_date,
    next_billing_date,
    stripe_subscription_id,
    stripe_customer_id
  } = req.body;
  const targetUserId = isAdmin(req) && user_id ? user_id : req.user.id;
  const created_by = req.user.email;
  try {
    const result = await db.query(
      `INSERT INTO subscriptions (
        user_id, start_date, end_date, status, created_by, created_at,
        plan, billing_period, amount, trial_end_date, next_billing_date,
        stripe_subscription_id, stripe_customer_id
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        targetUserId,
        start_date,
        end_date,
        status || 'active',
        created_by,
        plan || 'profissional',
        billing_period || 'monthly',
        amount ?? null,
        trial_end_date || null,
        next_billing_date || null,
        stripe_subscription_id || null,
        stripe_customer_id || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar assinatura
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const allowedFields = [
      'user_id',
      'start_date',
      'end_date',
      'status',
      'plan',
      'billing_period',
      'amount',
      'trial_end_date',
      'next_billing_date',
      'stripe_subscription_id',
      'stripe_customer_id'
    ];
    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'user_id' && !isAdmin(req)) {
          continue;
        }
        params.push(req.body[field]);
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    params.push(parseInt(req.params.id));
    let query = `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $${params.length}`;

    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assinatura não encontrada ou sem permissão' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar assinatura
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM subscriptions WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assinatura não encontrada ou sem permissão' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
