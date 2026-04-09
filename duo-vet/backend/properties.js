// Rotas de propriedades

const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Listar todas as propriedades
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by, client_id } = req.query;
    let query = 'SELECT id, client_id, name, address, details, created_by, created_at FROM properties';
    const params = [];
    const whereClauses = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      const userEmail = req.user.email.trim().toLowerCase();
      console.log(`GET /api/properties: Filtering by user email: "${userEmail}"`);
      params.push(userEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    } else if (created_by && (created_by !== 'undefined' && created_by !== 'null' && created_by !== '')) {
      const filterEmail = created_by.trim().toLowerCase();
      console.log(`GET /api/properties: Admin filtering by: "${filterEmail}"`);
      params.push(filterEmail);
      whereClauses.push(`LOWER(TRIM(created_by)) = $${params.length}`);
    }

    const clientIdValue = client_id ? parseInt(client_id) : null;
    if (clientIdValue && Number.isFinite(clientIdValue)) {
      params.push(clientIdValue);
      whereClauses.push(`client_id = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    
    // Flatten details for frontend convenience
    const flattenedRows = result.rows.map(row => {
      const { details, ...rest } = row;
      return {
        ...rest,
        ...(details || {})
      };
    });
    
    res.json(flattenedRows);
  } catch (err) {
    next(err);
  }
});

// Listar propriedades por cliente
router.get('/client/:clientId', authMiddleware, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    let query = 'SELECT id, client_id, name, address, details, created_by, created_at FROM properties WHERE client_id = $1';
    const params = [parseInt(clientId)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    
    // Flatten details for frontend convenience
    const flattenedRows = result.rows.map(row => {
      const { details, ...rest } = row;
      return {
        ...rest,
        ...(details || {})
      };
    });

    res.json(flattenedRows);
  } catch (err) {
    next(err);
  }
});

// Obter propriedade por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM properties WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Propriedade não encontrada' });
    
    const row = result.rows[0];
    const { details, ...rest } = row;
    const flattenedRow = {
      ...rest,
      ...(details || {})
    };
    
    res.json(flattenedRow);
  } catch (err) {
    next(err);
  }
});

// Criar nova propriedade
router.post('/', authMiddleware, async (req, res, next) => {
  const { client_id, name, address, details, ...otherFields } = req.body;
  // Garantimos que o created_by seja salvo sempre em lowercase e sem espaços
  const created_by = req.user && req.user.email ? req.user.email.trim().toLowerCase() : null;
  
  console.log(`[POST /api/properties] Attempting to create property for user: "${created_by}"`);
  try {
    const clientIdValue = client_id ? parseInt(client_id) : null;
    
    // Remove system fields from otherFields if present
    const { id, created_at, ...cleanOtherFields } = otherFields;

    // Merge provided details with other fields from body (like city, state, distance_km, etc.)
    const mergedDetails = {
      ...(details || {}),
      ...cleanOtherFields
    };

    const result = await db.query(
      'INSERT INTO properties (client_id, name, address, details, created_by, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [clientIdValue, name, address, JSON.stringify(mergedDetails), created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar propriedade
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { name, address, details, ...otherFields } = req.body;
  try {
    // Remove system fields from otherFields if present
    const { id, client_id, created_by: body_created_by, created_at, ...cleanOtherFields } = otherFields;

    // Merge provided details with other fields
    const mergedDetails = {
      ...(details || {}),
      ...cleanOtherFields
    };

    let query = 'UPDATE properties SET name = $1, address = $2, details = $3 WHERE id = $4';
    const params = [name, address, JSON.stringify(mergedDetails), parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($5)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Propriedade não encontrada ou sem permissão' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar propriedade
router.post('/:id/delete', authMiddleware, async (req, res, next) => { // Mantendo post para compatibilidade se necessário, ou delete
  try {
    let query = 'DELETE FROM properties WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Propriedade não encontrada ou sem permissão' });
    res.json({ message: 'Propriedade deletada com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Suporte para DELETE real também
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM properties WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Propriedade não encontrada ou sem permissão' });
    res.json({ message: 'Propriedade deletada com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
