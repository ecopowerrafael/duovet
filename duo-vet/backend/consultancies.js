const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const { ensureConsultancyChargeAgendaEvents, removeUpcomingConsultancyChargeEvents } = require('./consultancy_charge_events');

const router = express.Router();

async function ensureConsultancyPaymentReminder(consultancy) {
  if (!consultancy) return;
  if (consultancy.status !== 'ativa') return;
  if (!consultancy.payment_date) return;
  if (!consultancy.created_by) return;

  const paymentDate = new Date(consultancy.payment_date);
  if (Number.isNaN(paymentDate.getTime())) return;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const effectiveDay = Math.min(paymentDate.getDate(), daysInMonth);
  if (now.getDate() < effectiveDay) return;

  const existing = await db.query(
    `
      SELECT 1
      FROM notifications
      WHERE type = $1
        AND related_entity_type = 'consultancy'
        AND related_entity_id = $2
        AND LOWER(created_by) = LOWER($3)
        AND date_trunc('month', created_at) = date_trunc('month', NOW())
      LIMIT 1
    `,
    ['pagamento_pendente', consultancy.id, consultancy.created_by]
  );
  if (existing.rows.length > 0) return;

  const clientNameRes = consultancy.client_id
    ? await db.query('SELECT name FROM clients WHERE id = $1 LIMIT 1', [consultancy.client_id])
    : { rows: [] };
  const propertyNameRes = consultancy.property_id
    ? await db.query('SELECT name FROM properties WHERE id = $1 LIMIT 1', [consultancy.property_id])
    : { rows: [] };

  const clientName = clientNameRes.rows[0]?.name || 'Cliente';
  const propertyName = propertyNameRes.rows[0]?.name || 'Propriedade';
  const amountLabel = consultancy.value ? ` (R$ ${Number(consultancy.value).toFixed(2)})` : '';
  const title = 'Cobrança de consultoria';
  const description = `Hoje é dia de cobrança da consultoria para ${clientName} (${propertyName})${amountLabel}.`;

  await db.query(
    `
      INSERT INTO notifications (type, title, description, status, created_by, related_entity_type, related_entity_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `,
    ['pagamento_pendente', title, description, 'unread', consultancy.created_by, 'consultancy', consultancy.id]
  );
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM consultancies';
    const params = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined' && created_by !== 'null' && created_by !== '') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM consultancies WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Consultoria não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  const {
    client_id,
    property_id,
    type,
    technical_area,
    scope,
    start_date,
    end_date,
    status,
    frequency,
    next_return_date,
    payment_date,
    value,
    billing_type,
    observations,
    technical_notes,
    start_time,
    end_time
  } = req.body;

  const created_by = req.user.email;

  try {
    const result = await db.query(
      `INSERT INTO consultancies (
        client_id, property_id, type, technical_area, scope,
        start_date, end_date, status, frequency, next_return_date, payment_date,
        value, billing_type, observations, technical_notes,
        start_time, end_time, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, NOW(), NOW()
      ) RETURNING *`,
      [
        client_id || null,
        property_id || null,
        type || 'pontual',
        technical_area || null,
        scope || null,
        start_date || null,
        end_date || null,
        status || 'ativa',
        frequency || null,
        next_return_date || null,
        payment_date || null,
        value || null,
        billing_type || null,
        observations || null,
        technical_notes || null,
        start_time || null,
        end_time || null,
        created_by
      ]
    );
    const created = result.rows[0];
    await ensureConsultancyPaymentReminder(created);
    await ensureConsultancyChargeAgendaEvents(created);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  const {
    client_id,
    property_id,
    type,
    technical_area,
    scope,
    start_date,
    end_date,
    status,
    frequency,
    next_return_date,
    payment_date,
    value,
    billing_type,
    observations,
    technical_notes,
    start_time,
    end_time
  } = req.body;

  try {
    let query = `UPDATE consultancies SET
      client_id = $1,
      property_id = $2,
      type = $3,
      technical_area = $4,
      scope = $5,
      start_date = $6,
      end_date = $7,
      status = $8,
      frequency = $9,
      next_return_date = $10,
      payment_date = $11,
      value = $12,
      billing_type = $13,
      observations = $14,
      technical_notes = $15,
      start_time = $16,
      end_time = $17,
      updated_at = NOW()
      WHERE id = $18`;

    const params = [
      client_id || null,
      property_id || null,
      type || 'pontual',
      technical_area || null,
      scope || null,
      start_date || null,
      end_date || null,
      status || 'ativa',
      frequency || null,
      next_return_date || null,
      payment_date || null,
      value || null,
      billing_type || null,
      observations || null,
      technical_notes || null,
      start_time || null,
      end_time || null,
      parseInt(req.params.id)
    ];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($19)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';
    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Consultoria não encontrada' });
    const updated = result.rows[0];
    await ensureConsultancyPaymentReminder(updated);
    await ensureConsultancyChargeAgendaEvents(updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM consultancies WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';
    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Consultoria não encontrada' });
    const removed = result.rows[0];
    await removeUpcomingConsultancyChargeEvents({
      consultancyId: removed.id,
      createdBy: removed.created_by
    });
    res.json(removed);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
