// Rotas para dados reprodutivos e andrológicos
const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();
const db = require('./db');

router.get('/reproductivedata', authMiddleware, async (req, res, next) => {
  try {
    const { animal_id, created_by } = req.query;
    if (!animal_id) return res.status(400).json({ error: 'animal_id é obrigatório' });

    const animalIdValue = parseInt(animal_id);
    if (!Number.isFinite(animalIdValue)) return res.status(400).json({ error: 'animal_id inválido' });

    let query = 'SELECT id, date, reproductive_data, appointment_id FROM appointments WHERE (animal_id = $1 OR animal_ids @> ARRAY[$1]::integer[]) AND type = \'reprodutivo\' AND reproductive_data IS NOT NULL';
    const params = [animalIdValue];

    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      // Se for admin mas passou um filtro específico (case-insensitive)
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(created_by);
    }

    query += ' ORDER BY date DESC';
    const result = await db.query(query, params);

    // Mapear para o formato esperado pelo frontend
    const mapped = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      appointment_id: row.appointment_id || row.id.toString(),
      ...row.reproductive_data
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// Listar dados andrológicos por animal
router.get('/andrologicaldata', authMiddleware, async (req, res, next) => {
  try {
    const { animal_id, created_by } = req.query;
    if (!animal_id) return res.status(400).json({ error: 'animal_id é obrigatório' });

    const animalIdValue = parseInt(animal_id);
    if (!Number.isFinite(animalIdValue)) return res.status(400).json({ error: 'animal_id inválido' });

    let query = 'SELECT id, date, andrological_data, appointment_id FROM appointments WHERE (animal_id = $1 OR animal_ids @> ARRAY[$1]::integer[]) AND type = \'reprodutivo\' AND andrological_data IS NOT NULL';
    const params = [animalIdValue];

    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      // Se for admin mas passou um filtro específico (case-insensitive)
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(created_by);
    }

    query += ' ORDER BY date DESC';
    const result = await db.query(query, params);

    // Mapear para o formato esperado pelo frontend
    const mapped = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      appointment_id: row.appointment_id || row.id.toString(),
      ...row.andrological_data
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
