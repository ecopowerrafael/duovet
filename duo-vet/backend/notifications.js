const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Listar todas as notificações
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM notifications';
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
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter notificação por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM notifications WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notificação não encontrada ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar nova notificação
router.post('/', authMiddleware, async (req, res, next) => {
  const { type, title, description, status, related_entity_type, related_entity_id } = req.body;
  
  // Se for admin, pode definir o destinatário (created_by) no corpo da requisição.
  // Caso contrário, a notificação é para o próprio usuário.
  let recipient = req.user.email;
  if (req.user.email === 'admin@duovet.app' && req.body.created_by) {
    recipient = req.body.created_by;
  }

  try {
    const result = await db.query(
      'INSERT INTO notifications (type, title, description, status, created_by, related_entity_type, related_entity_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
      [type, title, description, status || 'unread', recipient, related_entity_type, related_entity_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Enviar notificação para todos os usuários (Broadcast)
router.post('/broadcast', authMiddleware, async (req, res, next) => {
  if (req.user.email !== 'admin@duovet.app') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const { type, title, description, related_entity_type, related_entity_id } = req.body;

  try {
    // Buscar todos os usuários
    const usersResult = await db.query('SELECT email FROM users');
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.json({ message: 'Nenhum usuário encontrado para notificar' });
    }

    // Criar notificações para todos
    const values = [];
    const placeholders = [];
    let counter = 1;

    users.forEach((user, index) => {
      placeholders.push(`($${counter++}, $${counter++}, $${counter++}, $${counter++}, $${counter++}, $${counter++}, $${counter++}, NOW())`);
      values.push(type, title, description, 'unread', user.email, related_entity_type || null, related_entity_id || null);
    });

    const query = `
      INSERT INTO notifications (type, title, description, status, created_by, related_entity_type, related_entity_id, created_at)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await db.query(query, values);
    res.status(201).json({ 
      message: `${result.rowCount} notificações enviadas com sucesso`,
      count: result.rowCount 
    });
  } catch (err) {
    next(err);
  }
});

// Atualizar notificação
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { status } = req.body;
  try {
    let query = 'UPDATE notifications SET status = $1 WHERE id = $2';
    const params = [status, parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($3)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notificação não encontrada ou acesso negado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar notificação
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM notifications WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notificação não encontrada ou acesso negado' });
    res.json({ message: 'Notificação deletada com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
