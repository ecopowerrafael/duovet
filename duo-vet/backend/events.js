const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const { syncEventToGoogle, unsyncEventFromGoogle } = require('./google_calendar');
const router = express.Router();

console.log('Events router loaded');

// Listar eventos
router.get('/', authMiddleware, async (req, res, next) => {
  console.log('GET /api/events handler called');
  try {
    const { created_by, sort } = req.query;
    // TODO: Filter by created_by (email) if provided, or use req.user.id
    // For now, we return all events or filter by user_id if we add it to schema
    
    // We assume the table is 'events'
    let query = 'SELECT * FROM events';
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
    
    if (sort) {
      // simple sort handling
      if (sort === '-start_datetime') {
        query += ' ORDER BY start_datetime DESC';
      } else if (sort === 'start_datetime') {
        query += ' ORDER BY start_datetime ASC';
      }
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar eventos:', err);
    next(err);
  }
});

// Criar evento
router.post('/', authMiddleware, async (req, res, next) => {
  const { 
    title, event_type, start_datetime, end_datetime, 
    client_id, property_id, animal_ids, appointment_type, 
    location, notes, status, reminder_1day, reminder_1hour, reminder_15min, appointment_id 
  } = req.body;

  // Use email from token or body? Frontend sends created_by in query for GET, but maybe not in POST?
  // We can use req.user.email from authMiddleware
  const created_by = req.user ? req.user.email : 'system';

  try {
    const result = await db.query(
      `INSERT INTO events (
        title, event_type, start_datetime, end_datetime, 
        client_id, property_id, animal_ids, appointment_type, 
        location, notes, status, reminder_1day, reminder_1hour, reminder_15min,
        created_by, created_at, appointment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16) RETURNING *`,
      [
        title, event_type, start_datetime, end_datetime, 
        client_id || null, property_id || null, animal_ids || null, appointment_type || null, 
        location || null, notes || null, status || 'scheduled', reminder_1day || false, reminder_1hour || false, reminder_15min || false,
        created_by, appointment_id || null
      ]
    );
    
    const event = result.rows[0];
    
    // Auto sync to Google Calendar if user is connected
    if (req.user && req.user.id) {
      syncEventToGoogle(event.id, req.user.id, req.user.email).catch(err => {
        console.error('Background auto-sync error:', err);
      });
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Erro ao criar evento:', err);
    next(err);
  }
});

// Atualizar evento
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { 
    title, event_type, start_datetime, end_datetime, 
    client_id, property_id, animal_ids, appointment_type, 
    location, notes, status, reminder_1day, reminder_1hour, reminder_15min, appointment_id 
  } = req.body;
  
  try {
    let query = `UPDATE events SET 
        title=$1, event_type=$2, start_datetime=$3, end_datetime=$4, 
        client_id=$5, property_id=$6, animal_ids=$7, appointment_type=$8, 
        location=$9, notes=$10, status=$11, reminder_1day=$12, reminder_1hour=$13, reminder_15min=$14,
        appointment_id=$15
       WHERE id = $16`;
    
    const params = [
      title, event_type, start_datetime, end_datetime, 
      client_id, property_id, animal_ids, appointment_type, 
      location, notes, status, reminder_1day, reminder_1hour, reminder_15min,
      appointment_id,
      req.params.id
    ];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($17)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado' });
    const event = result.rows[0];
    
    // Auto sync update to Google Calendar
    if (req.user && req.user.id) {
      syncEventToGoogle(event.id, req.user.id, req.user.email).catch(err => {
        console.error('Background update-sync error:', err);
      });
    }

    res.json(event);
  } catch (err) {
    console.error('Erro ao atualizar evento:', err);
    next(err);
  }
});

// Deletar evento
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM events WHERE id = $1';
    const params = [req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Evento não encontrado' });
    const event = result.rows[0];
    
    // Auto remove from Google Calendar
    if (req.user && req.user.id) {
      unsyncEventFromGoogle(req.params.id, req.user.id, req.user.email).catch(err => {
        console.error('Background delete-unsync error:', err);
      });
    }

    res.json(event);
  } catch (err) {
    console.error('Erro ao deletar evento:', err);
    next(err);
  }
});

module.exports = router;
