// Rotas de animais

const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Conexão com PostgreSQL
const db = require('./db');

// Listar todos os animais
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by, client_id, property_id } = req.query;
    let query = 'SELECT * FROM animals';
    const params = [];
    const whereClauses = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      const userEmail = req.user.email.trim().toLowerCase();
      console.log(`GET /api/animals: Filtering by user email: "${userEmail}"`);
      params.push(userEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      const filterEmail = created_by.trim().toLowerCase();
      console.log(`GET /api/animals: Admin filtering by: "${filterEmail}"`);
      params.push(filterEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    }

    const clientIdValue = client_id ? parseInt(client_id) : null;
    if (clientIdValue && Number.isFinite(clientIdValue)) {
      params.push(clientIdValue);
      const idx = params.length;
      whereClauses.push(`(owner_id = $${idx} OR client_id = $${idx})`);
    }

    const propertyIdValue = property_id ? parseInt(property_id) : null;
    if (propertyIdValue && Number.isFinite(propertyIdValue)) {
      params.push(propertyIdValue);
      whereClauses.push(`property_id = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter animal por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM animals WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Animal não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo animal
router.post('/', authMiddleware, async (req, res, next) => {
  const { 
    name, species, breed, birthdate, birth_date, sex, identification, color, weight, 
    owner_id, client_id, property_id, father_id, mother_id, father_name, mother_name, 
    father_breed, mother_breed, father_notes, mother_notes, notes, status 
  } = req.body;
  
  const finalOwnerId = owner_id || client_id;
  // Garantimos que o created_by seja salvo sempre em lowercase e sem espaços
  const created_by = req.user && req.user.email ? req.user.email.trim().toLowerCase() : null;
  
  console.log(`[POST /api/animals] Attempting to create animal for user: "${created_by}"`);

  // Helper function to sanitize inputs (convert empty strings to null)
  const sanitize = (val) => {
    if (val === '' || val === undefined || val === 'undefined' || val === null) return null;
    return val;
  };

  const sanitizedData = {
    name: sanitize(name),
    species: sanitize(species),
    breed: sanitize(breed),
    birthdate: sanitize(birthdate),
    birth_date: sanitize(birth_date),
    sex: sanitize(sex),
    identification: sanitize(identification),
    color: sanitize(color),
    weight: sanitize(weight),
    owner_id: sanitize(finalOwnerId),
    property_id: sanitize(property_id),
    father_id: sanitize(father_id),
    mother_id: sanitize(mother_id),
    father_name: sanitize(father_name),
    mother_name: sanitize(mother_name),
    father_breed: sanitize(father_breed),
    mother_breed: sanitize(mother_breed),
    father_notes: sanitize(father_notes),
    mother_notes: sanitize(mother_notes),
    notes: sanitize(notes),
    status: sanitize(status) || 'ativo',
    created_by: sanitize(created_by)
  };

  // Ensure dates are valid or null
  if (sanitizedData.birthdate && isNaN(Date.parse(sanitizedData.birthdate))) sanitizedData.birthdate = null;
  if (sanitizedData.birth_date && isNaN(Date.parse(sanitizedData.birth_date))) sanitizedData.birth_date = null;

  // Debug payload before insert
  console.log('[POST /api/animals] Sanitized data for DB:', JSON.stringify(sanitizedData, null, 2));

  try {
    console.log(`[POST /api/animals] Executing INSERT for user: "${sanitizedData.created_by}"`);
    const result = await db.query(
      `INSERT INTO animals (
        name, species, breed, birthdate, birth_date, sex, identification, color, weight, 
        owner_id, property_id, father_id, mother_id, father_name, mother_name, 
        father_breed, mother_breed, father_notes, mother_notes, notes, status, 
        created_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 
        $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, 
        $22, NOW()
      ) RETURNING *`,
      [
        sanitizedData.name, sanitizedData.species, sanitizedData.breed, sanitizedData.birthdate, sanitizedData.birth_date || sanitizedData.birthdate, sanitizedData.sex, sanitizedData.identification, sanitizedData.color, sanitizedData.weight,
        sanitizedData.owner_id, sanitizedData.property_id, sanitizedData.father_id, sanitizedData.mother_id, sanitizedData.father_name, sanitizedData.mother_name,
        sanitizedData.father_breed, sanitizedData.mother_breed, sanitizedData.father_notes, sanitizedData.mother_notes, sanitizedData.notes, sanitizedData.status,
        sanitizedData.created_by
      ]
    );
    console.log(`[POST /api/animals] Success! Animal ID: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/animals] DATABASE ERROR:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      stack: err.stack
    });
    // Check for foreign key violation
    if (err.code === '23503') {
        if (err.constraint === 'animals_property_id_fkey') {
            return res.status(400).json({ error: 'Propriedade inválida ou não encontrada.' });
        }
        if (err.constraint === 'animals_owner_id_fkey') {
            return res.status(400).json({ error: 'Cliente/Proprietário inválido ou não encontrado.' });
        }
    }
    next(err);
  }
});

// Atualizar animal
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { 
    name, species, breed, birthdate, birth_date, sex, identification, color, weight, 
    owner_id, client_id, property_id, father_id, mother_id, father_name, mother_name, 
    father_breed, mother_breed, father_notes, mother_notes, notes, status 
  } = req.body;

  const finalOwnerId = owner_id || client_id;

  try {
    let query = `UPDATE animals SET 
        name = $1, species = $2, breed = $3, birthdate = $4, birth_date = $5, 
        sex = $6, identification = $7, color = $8, weight = $9, owner_id = $10, 
        property_id = $11, father_id = $12, mother_id = $13, father_name = $14, 
        mother_name = $15, father_breed = $16, mother_breed = $17, father_notes = $18, 
        mother_notes = $19, notes = $20, status = $21 
      WHERE id = $22`;
    
    const params = [
      name, species, breed, birthdate, birth_date || birthdate, sex, identification, color, weight,
      finalOwnerId, property_id, father_id, mother_id, father_name, mother_name,
      father_breed, mother_breed, father_notes, mother_notes, notes, status,
      parseInt(req.params.id)
    ];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($23)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Animal não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar animal
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM animals WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Animal não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
