const express = require('express');
const router = express.Router();
const db = require('./db');
const { authMiddleware } = require('./auth');

// List protocols
router.get('/', authMiddleware, async (req, res, next) => {
  const { created_by, sort } = req.query;
  let query = 'SELECT * FROM protocols';
  const params = [];

  // Se não for admin, filtra pelo criador (case-insensitive)
  if (req.user && req.user.email !== 'admin@duovet.app') {
    query += ' WHERE LOWER(created_by) = LOWER($1)';
    params.push(req.user.email);
  } else if (created_by && created_by !== 'undefined') {
    // Se for admin mas passou um filtro específico (case-insensitive)
    query += ' WHERE LOWER(created_by) = LOWER($1)';
    params.push(created_by);
  }

  if (sort) {
    const order = sort.startsWith('-') ? 'DESC' : 'ASC';
    const field = sort.replace('-', '');
    // Prevent SQL injection on sort field
    const allowedSortFields = ['created_at', 'name', 'type'];
    if (allowedSortFields.includes(field)) {
      query += ` ORDER BY ${field} ${order}`;
    } else {
      query += ' ORDER BY created_at DESC';
    }
  } else {
    query += ' ORDER BY created_at DESC';
  }

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create protocol
router.post('/', authMiddleware, async (req, res, next) => {
  const { 
    name, type, subtype, description, 
    default_procedures, default_medications, 
    follow_up_days, observations_template, is_active 
  } = req.body;
  
  const created_by = req.user.email;

  try {
    const result = await db.query(
      `INSERT INTO protocols (
        name, type, subtype, description, 
        default_procedures, default_medications, 
        follow_up_days, observations_template, is_active, 
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
      [
        name, type, subtype, description,
        JSON.stringify(default_procedures || []),
        JSON.stringify(default_medications || []),
        follow_up_days, observations_template, is_active !== false,
        created_by
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get protocol by ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM protocols WHERE id = $1';
    const params = [req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Protocolo não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update protocol
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  const allowedFields = [
    'name', 'type', 'subtype', 'description', 
    'default_procedures', 'default_medications', 
    'follow_up_days', 'observations_template', 'is_active'
  ];
  
  const fields = [];
  const values = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      if ((field === 'default_procedures' || field === 'default_medications') && typeof updates[field] === 'object') {
        values.push(JSON.stringify(updates[field]));
      } else {
        values.push(updates[field]);
      }
      idx++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  let query = `UPDATE protocols SET ${fields.join(', ')} WHERE id = $${idx}`;
  
  if (req.user && req.user.email !== 'admin@duovet.app') {
    idx++;
    query += ` AND LOWER(created_by) = LOWER($${idx})`;
    values.push(req.user.email);
  }

  query += ' RETURNING *';

  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Protocolo não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete protocol
router.delete('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  try {
    let query = 'DELETE FROM protocols WHERE id = $1';
    const params = [id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Protocolo não encontrado ou acesso negado' });
    res.json({ message: 'Protocolo removido com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
