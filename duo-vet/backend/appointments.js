// Rotas de agendamentos

const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Conexão com PostgreSQL
const db = require('./db');

let appointmentsPhotosColumnExists = null;
async function hasAppointmentsPhotosColumn() {
  if (appointmentsPhotosColumnExists !== null) return appointmentsPhotosColumnExists;
  const result = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'photos'
    ) AS exists;
  `);
  appointmentsPhotosColumnExists = Boolean(result.rows[0]?.exists);
  return appointmentsPhotosColumnExists;
}

function normalizeCreatedByEmail(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function normalizeIntegerArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : null;
    })
    .filter((v) => v !== null);
}

async function syncPrescriptionFromAppointment(runner, appointmentRow, createdByEmail) {
  const appointment = appointmentRow || {};
  const createdBy = normalizeCreatedByEmail(createdByEmail || appointment.created_by);
  const appointmentId = appointment.id ? parseInt(String(appointment.id), 10) : null;
  if (!appointmentId || !Number.isFinite(appointmentId)) return;

  const medications = Array.isArray(appointment.medications) ? appointment.medications : [];
  if (medications.length === 0) return;

  const clientId = appointment.client_id ? parseInt(String(appointment.client_id), 10) : null;
  const animalIds = Array.isArray(appointment.animal_ids) && appointment.animal_ids.length > 0
    ? normalizeIntegerArray(appointment.animal_ids)
    : (appointment.animal_id ? normalizeIntegerArray([appointment.animal_id]) : []);

  const dateValue = appointment.date || new Date().toISOString();
  const notes = appointment.observations || '';
  const symptoms = appointment.symptoms || '';
  const diagnosis = appointment.diagnosis || '';
  const medicationsJson = JSON.stringify(medications);

  const existing = await runner.query(
    `SELECT id FROM prescriptions WHERE appointment_id = $1 AND LOWER(TRIM(created_by)) = LOWER(TRIM($2)) ORDER BY id DESC LIMIT 1`,
    [appointmentId, createdBy || '']
  );

  if (existing.rows.length > 0) {
    const prescriptionId = existing.rows[0].id;
    await runner.query(
      `UPDATE prescriptions
       SET client_id = $1,
           animal_ids = $2,
           date = $3,
           medications = $4::jsonb,
           notes = $5,
           symptoms = $6,
           diagnosis = $7,
           created_by = $8
       WHERE id = $9`,
      [clientId, animalIds, dateValue, medicationsJson, notes, symptoms, diagnosis, createdBy, prescriptionId]
    );
    return;
  }

  await runner.query(
    `INSERT INTO prescriptions (client_id, animal_ids, appointment_id, date, medications, notes, symptoms, diagnosis, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NOW())`,
    [clientId, animalIds, appointmentId, dateValue, medicationsJson, notes, symptoms, diagnosis, createdBy]
  );
}

// Listar todos os agendamentos
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by, client_id, property_id, animal_id, sort } = req.query;
    let query = 'SELECT * FROM appointments';
    const params = [];
    const whereClauses = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      const userEmail = req.user.email.trim().toLowerCase();
      console.log(`GET /api/appointments: Filtering by user email: "${userEmail}"`);
      params.push(userEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      const filterEmail = created_by.trim().toLowerCase();
      console.log(`GET /api/appointments: Admin filtering by: "${filterEmail}"`);
      params.push(filterEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    }

    const clientIdValue = client_id ? parseInt(client_id) : null;
    if (clientIdValue && Number.isFinite(clientIdValue)) {
      params.push(clientIdValue);
      whereClauses.push(`client_id = $${params.length}`);
    }

    const propertyIdValue = property_id ? parseInt(property_id) : null;
    if (propertyIdValue && Number.isFinite(propertyIdValue)) {
      params.push(propertyIdValue);
      whereClauses.push(`property_id = $${params.length}`);
    }

    const animalIdValue = animal_id ? parseInt(animal_id) : null;
    if (animalIdValue && Number.isFinite(animalIdValue)) {
      params.push(animalIdValue);
      whereClauses.push(`(animal_id = $${params.length} OR animal_ids @> ARRAY[$${params.length}]::integer[])`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const sortValue = String(sort || '').trim();
    if (sortValue === '-date') query += ' ORDER BY date DESC NULLS LAST';
    else if (sortValue === 'date') query += ' ORDER BY date ASC NULLS LAST';
    else if (sortValue === '-created_at') query += ' ORDER BY created_at DESC NULLS LAST';
    else if (sortValue === 'created_at') query += ' ORDER BY created_at ASC NULLS LAST';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter agendamento por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM appointments WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo agendamento
router.post('/', authMiddleware, async (req, res, next) => {
  const { 
    animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
    type, subtype, symptoms, diagnosis, observations,
    procedures, medications, reproductive_data, andrological_data, consultoria_data, photos,
    total_amount, displacement_cost,
    needs_return, return_date, return_time, return_type, return_notes, return_status
  } = req.body;
  
  // Garantimos que o created_by seja salvo sempre em lowercase e sem espaços
  const created_by = req.user && req.user.email ? req.user.email.trim().toLowerCase() : null;
  
  console.log(`[POST /api/appointments] Attempting to create appointment for user: "${created_by}"`);

  // Combine return_date and return_time if both exist
  let finalReturnDate = return_date;
  if (return_date && return_time) {
    finalReturnDate = `${return_date}T${return_time}:00`;
  }
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const photosColumnExists = await hasAppointmentsPhotosColumn();
    const result = photosColumnExists
      ? await client.query(
          `INSERT INTO appointments (
            animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
            type, subtype, symptoms, diagnosis, observations,
            procedures, medications, reproductive_data, andrological_data, consultoria_data, photos,
            total_amount, displacement_cost, 
            needs_return, return_date, return_type, return_notes, return_status,
            created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            $8, $9, $10, $11, $12, 
            $13, $14, $15, $16, $17, $18, 
            $19, $20, 
            $21, $22, $23, $24, $25, $26,
            $27, NOW()
          ) RETURNING *`,
          [
            animal_id, animal_ids, lot_id, client_id, property_id, date, description, status || 'scheduled',
            type, subtype, symptoms, diagnosis, observations,
            JSON.stringify(procedures), JSON.stringify(medications), JSON.stringify(reproductive_data), 
            JSON.stringify(andrological_data), JSON.stringify(consultoria_data), JSON.stringify(photos),
            total_amount, displacement_cost,
            needs_return || false, finalReturnDate, return_type, return_notes, return_status,
            created_by
          ]
        )
      : await client.query(
          `INSERT INTO appointments (
            animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
            type, subtype, symptoms, diagnosis, observations,
            procedures, medications, reproductive_data, andrological_data, consultoria_data,
            total_amount, displacement_cost, 
            needs_return, return_date, return_type, return_notes, return_status,
            created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 
            $8, $9, $10, $11, $12, 
            $13, $14, $15, $16, $17, 
            $18, $19, 
            $20, $21, $22, $23, $24, $25,
            $26, NOW()
          ) RETURNING *`,
          [
            animal_id, animal_ids, lot_id, client_id, property_id, date, description, status || 'scheduled',
            type, subtype, symptoms, diagnosis, observations,
            JSON.stringify(procedures), JSON.stringify(medications), JSON.stringify(reproductive_data), 
            JSON.stringify(andrological_data), JSON.stringify(consultoria_data),
            total_amount, displacement_cost,
            needs_return || false, finalReturnDate, return_type, return_notes, return_status,
            created_by
          ]
        );
    const appointment = result.rows[0];

    try {
      await syncPrescriptionFromAppointment(client, appointment, created_by);
    } catch (e) {
      console.error('Erro ao sincronizar prescrição do atendimento:', e);
    }

    // Lógica de Estoque: Baixa automática para medicamentos com product_id
    if (medications && Array.isArray(medications)) {
      for (const med of medications) {
        if (med.product_id && med.quantity > 0 && med.deduct_from_stock !== false) {
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, reason, appointment_id, created_by)
             VALUES ($1, 'out', $2, $3, $4, $5)`,
            [med.product_id, med.quantity, `Uso no atendimento #${appointment.id}`, appointment.id, created_by]
          );
          await client.query(
            `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2`,
            [med.quantity, med.product_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(appointment);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Atualizar agendamento
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { 
    animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
    type, subtype, symptoms, diagnosis, observations,
    procedures, medications, reproductive_data, andrological_data, consultoria_data, photos,
    total_amount, displacement_cost,
    needs_return, return_date, return_time, return_type, return_notes, return_status
  } = req.body;

  // Combine return_date and return_time if both exist
  let finalReturnDate = return_date;
  if (return_date && return_time) {
    finalReturnDate = `${return_date}T${return_time}:00`;
  }
  
  try {
    const photosColumnExists = await hasAppointmentsPhotosColumn();
    let query = photosColumnExists
      ? `UPDATE appointments SET 
        animal_id = $1, animal_ids = $2, lot_id = $3, client_id = $4, property_id = $5, 
        date = $6, description = $7, status = $8, type = $9, subtype = $10, 
        symptoms = $11, diagnosis = $12, observations = $13, 
        procedures = $14, medications = $15, reproductive_data = $16, 
        andrological_data = $17, consultoria_data = $18, photos = $19, 
        total_amount = $20, displacement_cost = $21, 
        needs_return = $22, return_date = $23, return_type = $24, 
        return_notes = $25, return_status = $26
      WHERE id = $27`
      : `UPDATE appointments SET 
        animal_id = $1, animal_ids = $2, lot_id = $3, client_id = $4, property_id = $5, 
        date = $6, description = $7, status = $8, type = $9, subtype = $10, 
        symptoms = $11, diagnosis = $12, observations = $13, 
        procedures = $14, medications = $15, reproductive_data = $16, 
        andrological_data = $17, consultoria_data = $18, 
        total_amount = $19, displacement_cost = $20, 
        needs_return = $21, return_date = $22, return_type = $23, 
        return_notes = $24, return_status = $25
      WHERE id = $26`;
    
    const params = photosColumnExists
      ? [
          animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
          type, subtype, symptoms, diagnosis, observations,
          JSON.stringify(procedures), JSON.stringify(medications), JSON.stringify(reproductive_data), 
          JSON.stringify(andrological_data), JSON.stringify(consultoria_data), JSON.stringify(photos),
          total_amount, displacement_cost,
          needs_return, finalReturnDate, return_type, return_notes, return_status,
          parseInt(req.params.id)
        ]
      : [
          animal_id, animal_ids, lot_id, client_id, property_id, date, description, status,
          type, subtype, symptoms, diagnosis, observations,
          JSON.stringify(procedures), JSON.stringify(medications), JSON.stringify(reproductive_data), 
          JSON.stringify(andrological_data), JSON.stringify(consultoria_data),
          total_amount, displacement_cost,
          needs_return, finalReturnDate, return_type, return_notes, return_status,
          parseInt(req.params.id)
        ];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ` AND LOWER(created_by) = LOWER($${params.length + 1})`;
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    try {
      await syncPrescriptionFromAppointment(db, result.rows[0], req.user?.email);
    } catch (e) {
      console.error('Erro ao sincronizar prescrição do atendimento:', e);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar agendamento
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM appointments WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Finalizar agendamento
router.post('/:id/finalize', authMiddleware, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const createdBy = normalizeCreatedByEmail(req.user?.email);
    
    // 1. Get appointment data
    let getQuery = 'SELECT * FROM appointments WHERE id = $1';
    const getParams = [parseInt(req.params.id)];
    if (req.user && req.user.email !== 'admin@duovet.app') {
      getQuery += ' AND LOWER(created_by) = LOWER($2)';
      getParams.push(req.user.email);
    }
    
    const apptResult = await client.query(getQuery, getParams);
    if (apptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    const appointment = apptResult.rows[0];
    
    // 2. Update status to 'finalizado'
    await client.query("UPDATE appointments SET status = 'finalizado' WHERE id = $1", [appointment.id]);

    try {
      await syncPrescriptionFromAppointment(client, appointment, createdBy);
    } catch (e) {
      console.error('Erro ao sincronizar prescrição do atendimento:', e);
    }
    
    // 3. Process medications for stock deduction
    const medications = appointment.medications || [];
    if (Array.isArray(medications)) {
      for (const med of medications) {
        if (med.product_id && med.quantity > 0 && med.deduct_from_stock !== false) {
          // Deduct from stock
          await client.query(
            'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
            [med.quantity, med.product_id]
          );
          
          // Record stock movement
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, reason, appointment_id, created_by)
             VALUES ($1, 'out', $2, $3, $4, $5)`,
            [med.product_id, med.quantity, `Atendimento #${appointment.id}`, appointment.id, createdBy]
          );
        }
      }
    }
    
    // 4. Create return event if needed (check for duplicates first)
    if (appointment.needs_return && appointment.return_date) {
      try {
        // Verificar se já existe um evento de retorno para este atendimento
        const existingEventResult = await client.query(
          `SELECT id FROM events WHERE appointment_id = $1 AND event_type = 'retorno'`,
          [appointment.id]
        );

        // Apenas criar se não existir already
        if (existingEventResult.rows.length === 0) {
          const returnTitle = `Retorno: ${appointment.type} - Atendimento #${appointment.id}`;
          const start = new Date(appointment.return_date);
          const end = new Date(start.getTime() + (60 * 60 * 1000));

          await client.query(
            `INSERT INTO events (
              title, event_type, start_datetime, end_datetime, client_id, property_id, 
              animal_ids, appointment_type, notes, status, created_by, appointment_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              returnTitle,
              'retorno',
              appointment.return_date,
              end.toISOString(),
              appointment.client_id,
              appointment.property_id,
              Array.isArray(appointment.animal_ids) ? appointment.animal_ids : null,
              appointment.type,
              appointment.return_notes || `Retorno agendado a partir do atendimento #${appointment.id}`,
              'agendado',
              createdBy,
              appointment.id
            ]
          );
        }
      } catch (eventErr) {
        console.error('Erro ao criar evento de retorno:', eventErr);
      }
    }
    
    await client.query('COMMIT');
    res.json({ ...appointment, status: 'finalizado' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error finalizing appointment:', err);
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
