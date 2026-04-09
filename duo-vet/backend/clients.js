// Rotas de clientes

const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Conexão com PostgreSQL
const db = require('./db');

// Listar todos os clientes
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM clients';
    const params = [];

    console.log('GET /api/clients: Request from user:', req.user ? { id: req.user.id, email: req.user.email } : 'None');

    // Se não for admin, filtra pelo criador (case-insensitive e sem espaços)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      const userEmail = req.user.email.trim().toLowerCase();
      console.log(`GET /api/clients: Filtering by user email: "${userEmail}"`);
      query += ' WHERE LOWER(TRIM(created_by)) = $1';
      params.push(userEmail);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      const filterEmail = created_by.trim().toLowerCase();
      console.log(`GET /api/clients: Admin filtering by: "${filterEmail}"`);
      query += ' WHERE LOWER(TRIM(created_by)) = $1';
      params.push(filterEmail);
    }
    
    console.log('GET /api/clients: Final query:', query, 'Params:', params);
    const result = await db.query(query, params);
    
    // Debug: Check ALL clients to see if the new one exists with a different created_by
    const allClientsDebug = await db.query('SELECT id, name, created_by FROM clients ORDER BY id DESC LIMIT 10');
    console.log('GET /api/clients: [DEBUG] Last 10 clients in DB:', JSON.stringify(allClientsDebug.rows, null, 2));
    
    // Also log specifically for this user to see what they should be seeing
    const userClientsDebug = await db.query('SELECT id, name, created_by FROM clients WHERE LOWER(created_by) = LOWER($1)', [req.user?.email || 'none']);
    console.log(`GET /api/clients: [DEBUG] Clients for user ${req.user?.email}:`, JSON.stringify(userClientsDebug.rows, null, 2));
    
    console.log('GET /api/clients: Result count:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('GET /api/clients: First client created_by:', result.rows[0].created_by);
    } else {
      console.log('GET /api/clients: No clients found');
    }
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/clients: Error:', err);
    next(err);
  }
});

// Obter cliente por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM clients WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar cliente
router.post('/', authMiddleware, async (req, res, next) => {
  console.log('[POST /api/clients] Received body:', JSON.stringify(req.body, null, 2));
  const { name, email, phone, address, document, notes, type, property, animal } = req.body;
  // Garantimos que o created_by seja salvo sempre em lowercase e sem espaços
  const created_by = req.user.email ? req.user.email.trim().toLowerCase() : null;
  
  console.log(`[POST /api/clients] Attempting to create client for user: "${created_by}"`);
  
  // Helper to handle empty strings as null for optional fields
  const nullIfEmpty = (val) => (val === '' || val === undefined) ? null : val;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Inserir cliente
    console.log('[POST /api/clients] Inserting client...');
    const clientResult = await client.query(
      'INSERT INTO clients (name, email, phone, address, document, notes, type, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
      [
        name, 
        nullIfEmpty(email), 
        nullIfEmpty(phone), 
        nullIfEmpty(address), 
        nullIfEmpty(document), 
        nullIfEmpty(notes), 
        nullIfEmpty(type) || 'produtor', 
        created_by
      ]
    );
    const newClient = clientResult.rows[0];
    console.log('[POST /api/clients] Client created successfully:', {
      id: newClient.id,
      name: newClient.name,
      created_by: newClient.created_by,
      db_returned_all_fields: Object.keys(newClient)
    });

    // Se houver propriedade, inserir
    if (property && property.name) {
      console.log('[POST /api/clients] Inserting property...');
      const { name: propName, address: propAddress, city, state, notes: propNotes, distance_km } = property;
      
      const mergedDetails = { 
        city: nullIfEmpty(city), 
        state: nullIfEmpty(state), 
        notes: nullIfEmpty(propNotes),
        distance_km: nullIfEmpty(distance_km)
      };
      
      const propResult = await client.query(
        'INSERT INTO properties (client_id, name, address, details, created_by, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [newClient.id, propName, nullIfEmpty(propAddress), JSON.stringify(mergedDetails), created_by]
      );
      const propertyId = propResult.rows[0].id;
      console.log('[POST /api/clients] Property created ID:', propertyId);

      // Se houver animal, inserir vinculado à propriedade
      if (animal && animal.name) {
        console.log('[POST /api/clients] Inserting animal...');
        const { 
          name: animalName, species, breed, sex, identification, 
          color, weight, notes: animalNotes, status, birth_date 
        } = animal;
        
        await client.query(
          'INSERT INTO animals (name, species, breed, sex, identification, color, weight, notes, status, birth_date, owner_id, property_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())',
          [
            animalName, 
            nullIfEmpty(species), 
            nullIfEmpty(breed), 
            nullIfEmpty(sex), 
            nullIfEmpty(identification), 
            nullIfEmpty(color), 
            nullIfEmpty(weight), 
            nullIfEmpty(animalNotes), 
            nullIfEmpty(status) || 'active', 
            nullIfEmpty(birth_date), 
            newClient.id, 
            propertyId, 
            created_by
          ]
        );
        console.log('[POST /api/clients] Animal created.');
      }
    }

    await client.query('COMMIT');
    console.log('[POST /api/clients] Transaction committed successfully. Created_by:', created_by);
    
    // Ensure the response includes created_by for frontend verification
    const finalResponse = {
      ...newClient,
      created_by: created_by
    };
    res.status(201).json(finalResponse);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/clients] Transaction failed, rolled back. Error:', err);
    next(err);
  } finally {
    client.release();
  }
});

// Atualizar cliente
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { name, email, phone, address, document, notes, type } = req.body;
  try {
    let query = 'UPDATE clients SET name = $1, email = $2, phone = $3, address = $4, document = $5, notes = $6, type = $7 WHERE id = $8';
    const params = [name, email, phone, address, document, notes, type, parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($9)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar cliente
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM clients WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
