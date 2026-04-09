const express = require('express');
const router = express.Router();
const db = require('./db');
const { authMiddleware } = require('./auth');

// GET all products for a user
router.get('/products', authMiddleware, async (req, res, next) => {
  const { created_by } = req.query;
  
  try {
    let query = 'SELECT * FROM products';
    const params = [];

    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined') {
      // Se for admin mas passou um filtro específico
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET single product
router.get('/products/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM products WHERE id = $1';
    const params = [req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST new product
router.post('/products', authMiddleware, async (req, res, next) => {
  const { name, description, category, unit, current_stock, minimum_stock, cost_price, sale_price } = req.body;
  const created_by = req.user.email;
  
  try {
    const result = await db.query(
      `INSERT INTO products (
        name, description, category, unit, current_stock, minimum_stock, cost_price, sale_price, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, description, category, unit, current_stock || 0, minimum_stock || 0, cost_price || 0, sale_price || 0, created_by]
    );
    
    // If initial stock > 0, create a movement
    if (current_stock > 0) {
      await db.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reason, created_by)
         VALUES ($1, 'in', $2, 'Estoque inicial', $3)`,
        [result.rows[0].id, current_stock, created_by]
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT update product
router.put('/products/:id', authMiddleware, async (req, res, next) => {
  const { name, description, category, unit, current_stock, minimum_stock, cost_price, sale_price } = req.body;
  
  try {
    let query = `UPDATE products SET 
        name = $1, description = $2, category = $3, unit = $4, 
        current_stock = $5, minimum_stock = $6, cost_price = $7, sale_price = $8
      WHERE id = $9`;
    
    const params = [name, description, category, unit, current_stock, minimum_stock, cost_price, sale_price, req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($10)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE product
router.delete('/products/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM products WHERE id = $1';
    const params = [req.params.id];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

// GET stock movements for a product
router.get('/movements', authMiddleware, async (req, res, next) => {
  const { product_id, created_by } = req.query;
  
  try {
    let query = 'SELECT * FROM stock_movements';
    const params = [];

    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined') {
      // Se for admin mas passou um filtro específico
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }
    
    if (product_id) {
      query += params.length > 0 ? ' AND product_id = $2' : ' WHERE product_id = $1';
      params.push(product_id);
    }
    
    query += ' ORDER BY date DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST new stock movement
router.post('/movements', authMiddleware, async (req, res, next) => {
  const { product_id, type, quantity, reason, appointment_id } = req.body;
  const created_by = req.user.email;
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Insert movement
    const movementRes = await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reason, appointment_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [product_id, type, quantity, reason, appointment_id, created_by]
    );
    
    // 2. Update product stock
    const operator = type === 'in' ? '+' : '-';
    await client.query(
      `UPDATE products SET current_stock = current_stock ${operator} $1 WHERE id = $2`,
      [quantity, product_id]
    );
    
    await client.query('COMMIT');
    res.status(201).json(movementRes.rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
});

// GET all inventory categories
router.get('/categories', authMiddleware, async (req, res, next) => {
  const { created_by } = req.query;
  try {
    let query = 'SELECT * FROM product_categories';
    const params = [];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST new inventory category
router.post('/categories', authMiddleware, async (req, res, next) => {
  const { name } = req.body;
  const created_by = req.user.email;
  
  try {
    const result = await db.query(
      'INSERT INTO product_categories (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
