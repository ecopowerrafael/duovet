// Rotas de usuários

const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Middleware para verificar se é admin
function adminMiddleware(req, res, next) {
  if (req.user && req.user.email === 'admin@duovet.app') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
  }
}

// Listar todos os usuários (apenas admin vê todos, outros veem apenas a si mesmos)
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    let query = `
      SELECT u.id, u.email, u.name, u.created_at, u.status,
             s.end_date as subscription_end,
             s.status as subscription_status
      FROM users u
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, end_date, status
        FROM subscriptions
        ORDER BY user_id, end_date DESC
      ) s ON u.id = s.user_id
    `;
    const params = [];

    // Se não for admin, filtra pelo próprio ID
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE u.id = $1';
      params.push(req.user.id);
    }

    query += ' ORDER BY u.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Admin altera senha de qualquer usuário
router.post('/:id/change-password', authMiddleware, adminMiddleware, async (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'Nova senha é obrigatória' });

  try {
    const hash = await bcrypt.hash(newPassword, 8);
    const result = await db.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email',
      [hash, parseInt(req.params.id)]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Senha alterada com sucesso pelo administrador', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Obter usuário por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    // Se não for admin, só pode ver a si mesmo
    if (req.user && req.user.email !== 'admin@duovet.app' && req.user.id !== id) {
      return res.status(403).json({ error: 'Acesso negado. Você só pode ver seu próprio perfil.' });
    }

    const result = await db.query('SELECT id, email, name, created_at, status FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Criar novo usuário (Apenas admin pode criar via esta rota)
router.post('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  const { email, password, name, status } = req.body;
  try {
    const hash = await bcrypt.hash(password, 8);
    const result = await db.query(
      'INSERT INTO users (email, password, name, created_at, status) VALUES ($1, $2, $3, NOW(), $4) RETURNING id, email, name, status',
      [email, hash, name, status || 'trial']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Atualizar usuário
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { email, name, status, password } = req.body;
  const id = parseInt(req.params.id);
  
  // Se não for admin, só pode atualizar a si mesmo e não pode mudar o status
  if (req.user && req.user.email !== 'admin@duovet.app') {
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Acesso negado. Você só pode atualizar seu próprio perfil.' });
    }
  }

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (email) {
      updates.push(`email = $${idx++}`);
      params.push(email);
    }
    if (name) {
      updates.push(`name = $${idx++}`);
      params.push(name);
    }
    // Apenas admin pode mudar status
    if (status && req.user.email === 'admin@duovet.app') {
      updates.push(`status = $${idx++}`);
      params.push(status);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 8);
      updates.push(`password = $${idx++}`);
      params.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    params.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, status`;
    
    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar usuário (Apenas admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [parseInt(req.params.id)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Usuário deletado com sucesso', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Ativar assinatura manualmente (Apenas admin)
router.post('/:id/activate-subscription', authMiddleware, adminMiddleware, async (req, res, next) => {
  const { billing_period, plan } = req.body;
  const userId = parseInt(req.params.id);

  if (!billing_period || !['monthly', 'yearly'].includes(billing_period)) {
    return res.status(400).json({ error: 'billing_period deve ser "monthly" ou "yearly"' });
  }

  if (!plan || !['autonomo', 'profissional', 'empresarial'].includes(plan)) {
    return res.status(400).json({ error: 'plan deve ser "autonomo", "profissional" ou "empresarial"' });
  }

  try {
    // Verificar se usuário existe
    const userResult = await db.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const user = userResult.rows[0];
    const now = new Date();
    const endDate = new Date(now);
    
    // Calcular data de vencimento
    if (billing_period === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Verificar se já existe subscription para este usuário
    const existingResult = await db.query(
      'SELECT id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (existingResult.rows.length > 0) {
      // Atualizar assinatura existente
      await db.query(
        `UPDATE subscriptions 
         SET status = $1, 
             start_date = NOW(), 
             end_date = $2, 
             next_billing_date = $2,
             billing_period = $3,
             plan = $4
         WHERE id = $5`,
        ['active', endDate, billing_period, plan, existingResult.rows[0].id]
      );
    } else {
      // Criar nova assinatura
      await db.query(
        `INSERT INTO subscriptions (user_id, start_date, end_date, status, billing_period, plan, created_at)
         VALUES ($1, NOW(), $2, $3, $4, $5, NOW())`,
        [userId, endDate, 'active', billing_period, plan]
      );
    }

    // Atualizar status do usuário para 'active'
    await db.query('UPDATE users SET status = $1 WHERE id = $2', ['active', userId]);

    res.json({ 
      message: 'Assinatura ativada com sucesso', 
      subscription: {
        user_id: userId,
        plan,
        billing_period,
        start_date: now,
        end_date: endDate,
        status: 'active'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
