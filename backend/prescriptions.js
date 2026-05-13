const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// List prescriptions
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM prescriptions';
    const params = [];

    // Se não for admin, filtra pelo criador (case-insensitive e sem espaços)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      const userEmail = req.user.email.trim().toLowerCase();
      console.log(`GET /api/prescriptions: Filtering by user email: "${userEmail}"`);
      query += ' WHERE LOWER(TRIM(created_by)) = $1';
      params.push(userEmail);
    } else if (created_by && created_by !== 'undefined') {
      const filterEmail = created_by.trim().toLowerCase();
      console.log(`GET /api/prescriptions: Admin filtering by: "${filterEmail}"`);
      query += ' WHERE LOWER(TRIM(created_by)) = $1';
      params.push(filterEmail);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create prescription
router.post('/', authMiddleware, async (req, res, next) => {
  const { client_id, animal_ids, appointment_id, date, medications, notes, symptoms, diagnosis } = req.body;
  // Garantimos que o created_by seja salvo sempre em lowercase e sem espaços
  const created_by = req.user && req.user.email ? req.user.email.trim().toLowerCase() : null;
  
  console.log(`[POST /api/prescriptions] Attempting to create prescription for user: "${created_by}"`);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO prescriptions (
        client_id, animal_ids, appointment_id, date, medications, notes, symptoms, diagnosis, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
      [
        client_id, 
        animal_ids, 
        appointment_id, 
        date, 
        JSON.stringify(medications), 
        notes,
        symptoms,
        diagnosis,
        created_by
      ]
    );
    const prescription = result.rows[0];

    // Lógica de Estoque: Baixa automática para medicamentos com product_id
    if (medications && Array.isArray(medications)) {
      for (const med of medications) {
        if (med.product_id && med.quantity > 0 && med.deduct_from_stock !== false) {
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, reason, prescription_id, created_by)
             VALUES ($1, 'out', $2, $3, $4, $5)`,
            [med.product_id, med.quantity, `Uso na receita #${prescription.id}`, prescription.id, created_by]
          );
          await client.query(
            `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`,
            [med.quantity, med.product_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(prescription);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Get prescription by ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM prescriptions WHERE id = $1';
    const params = [req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prescrição não encontrada ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update prescription
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  const allowedFields = ['client_id', 'animal_ids', 'appointment_id', 'date', 'medications', 'notes', 'symptoms', 'diagnosis'];
  
  const fields = [];
  const values = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      // Special handling for JSON fields if they are passed as objects
      if (field === 'medications' && typeof updates[field] === 'object') {
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
  let query = `UPDATE prescriptions SET ${fields.join(', ')} WHERE id = $${idx}`;
  
  if (req.user && req.user.email !== 'admin@duovet.app') {
    idx++;
    query += ` AND LOWER(created_by) = LOWER($${idx})`;
    values.push(req.user.email);
  }

  query += ' RETURNING *';

  try {
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescrição não encontrada ou acesso negado' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete prescription
router.delete('/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;

  try {
    let query = 'DELETE FROM prescriptions WHERE id = $1';
    const params = [id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescrição não encontrada ou acesso negado' });
    }
    
    res.json({ message: 'Prescrição deletada com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
