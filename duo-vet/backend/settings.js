// Rotas para configuração de chaves e parâmetros por usuário
const express = require('express');
const router = express.Router();
const db = require('./db');
const { authMiddleware } = require('./auth');
const PUBLIC_GLOBAL_SETTING_KEYS = [
  'planAutonomoActive',
  'planAutonomoMonthly',
  'planAutonomoYearly',
  'planProfissionalActive',
  'planProfissionalMonthly',
  'planProfissionalYearly',
  'planEmpresarialActive',
  'planEmpresarialMonthly',
  'planEmpresarialYearly',
  'planMonthly',
  'planYearly',
  'supportWhatsapp',
  'stripePublicKey'
];

// Todas as rotas de settings requerem autenticação
router.use(authMiddleware);

// Middleware para verificar se é admin
function adminMiddleware(req, res, next) {
  if (req.user && req.user.email === 'admin@duovet.app') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
  }
}

// Obter todas as configurações do usuário
router.get('/', async (req, res, next) => {
  const { user_id } = req.query;
  const wantsGlobalSettings = user_id === 'null';
  let targetUserId = req.user.id;
  let usePublicGlobalFilter = false;

  if (wantsGlobalSettings) {
    if (req.user && req.user.email === 'admin@duovet.app') {
      targetUserId = null;
    } else {
      targetUserId = null;
      usePublicGlobalFilter = true;
    }
  } else if (req.user && req.user.email === 'admin@duovet.app' && user_id) {
    targetUserId = parseInt(user_id);
  }

  try {
    let query = '';
    let params = [];
    if (targetUserId === null) {
      if (usePublicGlobalFilter) {
        query = 'SELECT key, value FROM settings WHERE user_id IS NULL AND key = ANY($1::text[])';
        params = [PUBLIC_GLOBAL_SETTING_KEYS];
      } else {
        query = 'SELECT key, value FROM settings WHERE user_id IS NULL';
      }
    } else {
      query = 'SELECT key, value FROM settings WHERE user_id = $1';
      params = [targetUserId];
    }
    
    const result = await db.query(query, params);
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  } catch (err) {
    next(err);
  }
});

// Atualizar múltiplas configurações (Bulk Update)
router.put('/', async (req, res, next) => {
  const { user_id } = req.query;
  let targetUserId = req.user.id;

  // Se for admin e passou um user_id, permite atualizar as configurações daquele usuário (ou globais se for 'null')
  if (req.user && req.user.email === 'admin@duovet.app' && user_id) {
    targetUserId = user_id === 'null' ? null : parseInt(user_id);
  }

  const entries = Object.entries(req.body || {});
  
  if (entries.length === 0) {
      return res.json({});
  }

  try {
    for (const [key, value] of entries) {
      // Ensure value is a string, as the column is TEXT
      let stringValue = value;
      if (typeof value === 'object' && value !== null) {
          stringValue = JSON.stringify(value);
      } else if (value === null || value === undefined) {
          stringValue = '';
      } else {
          stringValue = String(value);
      }

      if (targetUserId === null) {
        const updated = await db.query(
          'UPDATE settings SET value = $2 WHERE key = $1 AND user_id IS NULL',
          [key, stringValue]
        );
        if (updated.rowCount === 0) {
          await db.query(
            'INSERT INTO settings (key, value, user_id) VALUES ($1, $2, NULL)',
            [key, stringValue]
          );
        }
      } else {
        await db.query(
          `INSERT INTO settings (key, value, user_id) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (key, user_id) DO UPDATE SET value = $2`,
          [key, stringValue, targetUserId]
        );
      }
    }
    
    const selectQuery = targetUserId === null 
      ? 'SELECT key, value FROM settings WHERE user_id IS NULL' 
      : 'SELECT key, value FROM settings WHERE user_id = $1';
    const selectParams = targetUserId === null ? [] : [targetUserId];

    const result = await db.query(selectQuery, selectParams);
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  } catch (err) {
    next(err);
  }
});

// Atualizar ou criar chave (Single Key)
router.post('/set', async (req, res, next) => {
  const { key, value } = req.body;
  const userId = req.user.id;

  if (!key) return res.status(400).json({ error: 'Key obrigatória' });
  try {
    await db.query(
      `INSERT INTO settings (key, value, user_id) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (key, user_id) DO UPDATE SET value = $2`,
      [key, value, userId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Obter valor de uma chave específica
router.get('/:key', async (req, res, next) => {
  const userId = req.user.id;
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1 AND user_id = $2', [req.params.key, userId]);
    
    if (result.rows.length === 0) {
       return res.status(404).json({ error: 'Chave não encontrada' });
    }
    res.json({ value: result.rows[0].value });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
