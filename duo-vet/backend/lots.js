const express = require('express');
const router = express.Router();
const db = require('./db');
const { authMiddleware } = require('./auth');

// Listar lotes
router.get('/', authMiddleware, async (req, res, next) => {
  const { created_by, client_id } = req.query;
  try {
    let query = 'SELECT * FROM lots';
    const params = [];
    
    const conditions = [];
    
    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      params.push(req.user.email);
      conditions.push(`LOWER(created_by) = LOWER($${params.length})`);
    } else if (created_by && created_by !== 'undefined') {
      // Se for admin mas passou um filtro específico (case-insensitive)
      params.push(created_by);
      conditions.push(`LOWER(created_by) = LOWER($${params.length})`);
    }

    if (client_id) {
      params.push(client_id);
      conditions.push(`client_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Criar lote
router.post('/', authMiddleware, async (req, res, next) => {
  const { client_id, property_id, name, species, quantity, notes } = req.body;
  const created_by = req.user ? req.user.email : req.body.created_by;
  
  try {
    const result = await db.query(
      `INSERT INTO lots (client_id, property_id, name, species, quantity, notes, created_by, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [client_id, property_id, name, species, quantity || 0, notes, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar lote
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const { client_id, property_id, name, species, quantity, notes } = req.body;
  
  try {
    let query = `UPDATE lots SET client_id = $1, property_id = $2, name = $3, species = $4, quantity = $5, notes = $6 
                 WHERE id = $7`;
    const params = [client_id, property_id, name, species, quantity, notes, id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ` AND LOWER(created_by) = LOWER($8)`;
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lote não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar lote
router.delete('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  try {
    let query = 'DELETE FROM lots WHERE id = $1';
    const params = [id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lote não encontrado ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
