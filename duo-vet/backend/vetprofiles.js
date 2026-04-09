// Rotas de perfis veterinários
const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Listar todos os perfis
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM vet_profiles';
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
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter perfil por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM vet_profiles WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Perfil não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo perfil
router.post('/', authMiddleware, async (req, res, next) => {
  const { user_id, bio, specialty } = req.body;
  const created_by = req.user.email;
  try {
    const result = await db.query(
      'INSERT INTO vet_profiles (user_id, bio, specialty, created_by, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [user_id, bio, specialty, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar perfil
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { user_id, bio, specialty } = req.body;
  try {
    let query = 'UPDATE vet_profiles SET user_id = $1, bio = $2, specialty = $3 WHERE id = $4';
    const params = [user_id, bio, specialty, parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($5)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Perfil não encontrado ou sem permissão' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar perfil
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM vet_profiles WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Perfil não encontrado ou sem permissão' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
