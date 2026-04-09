const express = require('express');
const router = express.Router();
const db = require('./db');
const { authMiddleware } = require('./auth');

// Listar todas as despesas
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM expenses';
    const params = [];
    
    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined') {
      // Se for admin mas passou um filtro específico
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }
    query += ' ORDER BY date DESC, created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter despesa por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM expenses WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar nova despesa
router.post('/', authMiddleware, async (req, res, next) => {
  const { description, amount, date, category, payment_method, notes } = req.body;
  const created_by = req.user.email;
  try {
    const result = await db.query(
      `INSERT INTO expenses (
        description, amount, date, category, payment_method, notes, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [description, amount, date, category, payment_method, notes, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating expense:', err);
    next(err);
  }
});

// Atualizar despesa
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  const allowedFields = ['description', 'amount', 'date', 'category', 'payment_method', 'notes'];
  
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
  let query = `UPDATE expenses SET ${fields.join(', ')} WHERE id = $${idx}`;
  
  if (req.user && req.user.email !== 'admin@duovet.app') {
    idx++;
    query += ` AND LOWER(created_by) = LOWER($${idx})`;
    values.push(req.user.email);
  }

  query += ' RETURNING *';

  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    next(err);
  }
});

// Deletar despesa
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM expenses WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
