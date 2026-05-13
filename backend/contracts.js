const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Listar todos os contratos
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM contracts';
    const params = [];

    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      // Se for admin mas passou um filtro específico (case-insensitive)
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar contratos:', err);
    next(err);
  }
});

// Obter contrato por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM contracts WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo contrato
router.post('/', authMiddleware, async (req, res, next) => {
  const { 
    client_id, property_id, contract_type, billing_frequency, 
    amount, payment_method, start_date, next_billing_date,
    status, issue_invoice, description 
  } = req.body;
  
  const created_by = req.user.email;

  try {
    const result = await db.query(
      `INSERT INTO contracts (
        client_id, property_id, contract_type, billing_frequency, 
        amount, payment_method, start_date, next_billing_date,
        status, issue_invoice, description, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING *`,
      [
        client_id, property_id, contract_type, billing_frequency, 
        amount, payment_method, start_date, next_billing_date,
        status || 'ativo', issue_invoice || false, description, created_by
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar contrato:', err);
    next(err);
  }
});

// Atualizar contrato
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { 
    client_id, property_id, contract_type, billing_frequency, 
    amount, payment_method, start_date, next_billing_date,
    status, issue_invoice, description 
  } = req.body;
  
  try {
    let query = `UPDATE contracts SET 
        client_id = $1, property_id = $2, contract_type = $3, 
        billing_frequency = $4, amount = $5, payment_method = $6, 
        start_date = $7, next_billing_date = $8, status = $9, 
        issue_invoice = $10, description = $11
      WHERE id = $12`;
    
    const params = [
      client_id, property_id, contract_type, billing_frequency, 
      amount, payment_method, start_date, next_billing_date,
      status, issue_invoice, description, parseInt(req.params.id)
    ];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($13)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar contrato:', err);
    next(err);
  }
});

// Atualizar status do contrato
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  const { status } = req.body;
  try {
    let query = 'UPDATE contracts SET status = $1 WHERE id = $2';
    const params = [status, parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($3)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar contrato
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM contracts WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
