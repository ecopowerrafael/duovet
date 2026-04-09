const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');

const router = express.Router();

function isAdmin(req) {
  return req.user && req.user.email === 'admin@duovet.app';
}

function normalizeMessages(messages) {
  if (Array.isArray(messages)) return messages;
  if (!messages) return [];
  if (typeof messages === 'string') {
    try {
      const parsed = JSON.parse(messages);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'open' || value === 'waiting_user' || value === 'closed') return value;
  return 'open';
}

function normalizePriority(priority) {
  const value = String(priority || '').trim().toLowerCase();
  if (value === 'low' || value === 'normal' || value === 'high' || value === 'urgent') return value;
  return 'normal';
}

function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((item) => item && typeof item === 'object')
    .slice(0, 8)
    .map((item) => ({
      name: String(item.name || 'anexo'),
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
      type: String(item.type || ''),
      url: String(item.url || '')
    }))
    .filter((item) => item.url);
}

function appendMessage(messages, message) {
  const next = normalizeMessages(messages).concat(message);
  return JSON.stringify(next);
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { status, sort } = req.query;
    const params = [];
    const clauses = [];

    if (!isAdmin(req)) {
      params.push(req.user.id);
      clauses.push(`t.user_id = $${params.length}`);
    }

    const normalizedStatus = normalizeStatus(status);
    if (status && normalizedStatus) {
      params.push(normalizedStatus);
      clauses.push(`t.status = $${params.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = sort === 'waiting_time'
      ? `ORDER BY
          CASE t.status
            WHEN 'open' THEN 0
            WHEN 'waiting_user' THEN 1
            ELSE 2
          END,
          COALESCE(t.last_user_message_at, t.created_at) ASC`
      : 'ORDER BY t.updated_at DESC';

    const result = await db.query(
      `
        SELECT
          t.*,
          u.name AS user_name,
          u.email AS user_email,
          a.name AS assigned_admin_name,
          EXTRACT(EPOCH FROM (NOW() - COALESCE(t.last_user_message_at, t.created_at)))::BIGINT AS waiting_seconds
        FROM tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assigned_admin_id
        ${whereClause}
        ${orderBy}
      `,
      params
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const params = [ticketId];
    let query = `
      SELECT
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        a.name AS assigned_admin_name
      FROM tickets t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN users a ON a.id = t.assigned_admin_id
      WHERE t.id = $1
    `;

    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND t.user_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const subject = String(req.body?.subject || '').trim();
    const category = String(req.body?.category || '').trim();
    const description = String(req.body?.description || '').trim();
    const priority = normalizePriority(req.body?.priority);

    if (!subject) return res.status(400).json({ error: 'Assunto é obrigatório' });
    if (!category) return res.status(400).json({ error: 'Categoria é obrigatória' });
    if (!description) return res.status(400).json({ error: 'Descrição é obrigatória' });

    const nowIso = new Date().toISOString();
    const initialMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender: 'user',
      senderName: req.user.name || req.user.email || 'Usuário',
      text: description,
      attachments: sanitizeAttachments(req.body?.attachments),
      timestamp: nowIso
    };

    const result = await db.query(
      `
        INSERT INTO tickets (
          user_id,
          subject,
          category,
          description,
          status,
          priority,
          messages,
          created_by,
          last_user_message_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'open', $5, $6::jsonb, $7, NOW(), NOW())
        RETURNING *
      `,
      [
        req.user.id,
        subject,
        category,
        description,
        priority,
        JSON.stringify([initialMessage]),
        req.user.email
      ]
    );

    await db.query(
      `UPDATE tickets SET ticket_code = $2 WHERE id = $1`,
      [result.rows[0].id, `TKT-${String(result.rows[0].id).padStart(4, '0')}`]
    );

    const refreshed = await db.query(`SELECT * FROM tickets WHERE id = $1`, [result.rows[0].id]);
    res.status(201).json(refreshed.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', authMiddleware, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const text = String(req.body?.text || '').trim();
    const quickReply = String(req.body?.quickReply || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const params = [ticketId];
    let query = `SELECT * FROM tickets WHERE id = $1`;
    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }
    const ticketResult = await db.query(query, params);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    const ticket = ticketResult.rows[0];
    const sender = isAdmin(req) ? 'admin' : 'user';
    const nowIso = new Date().toISOString();
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender,
      senderName: req.user.name || req.user.email || (isAdmin(req) ? 'Admin' : 'Usuário'),
      text,
      quickReply: quickReply || null,
      attachments: sanitizeAttachments(req.body?.attachments),
      timestamp: nowIso
    };

    const status = sender === 'admin' ? 'waiting_user' : 'open';
    const updatedMessages = appendMessage(ticket.messages, message);
    const timestampColumn = sender === 'admin' ? 'last_admin_message_at' : 'last_user_message_at';

    const updated = await db.query(
      `
        UPDATE tickets
        SET
          messages = $2::jsonb,
          status = $3,
          ${timestampColumn} = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticketId, updatedMessages, status]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/close', authMiddleware, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const params = [ticketId];
    let query = `UPDATE tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1`;
    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }
    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/priority', authMiddleware, async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const priority = normalizePriority(req.body?.priority);
    const result = await db.query(
      `UPDATE tickets SET priority = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [ticketId, priority]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/assign-me', authMiddleware, async (req, res, next) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const result = await db.query(
      `UPDATE tickets SET assigned_admin_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [ticketId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const params = [ticketId];
    let query = `DELETE FROM tickets WHERE id = $1`;
    if (!isAdmin(req)) {
      params.push(req.user.id);
      query += ` AND user_id = $${params.length}`;
    }
    query += ' RETURNING id';

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
