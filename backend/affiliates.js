const express = require('express');
const db = require('./db');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

function adminMiddleware(req, res, next) {
  if (req.user && req.user.email === 'admin@duovet.app') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
  }
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function maskFirstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (!first) return 'Usuário';
  return `${first}***`;
}

async function ensureAffiliateProfile(client, userId) {
  await client.query(
    `INSERT INTO affiliates_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getAffiliateSettings(client) {
  const keys = ['affiliateDefaultCommission', 'affiliateMinPayout'];
  const result = await client.query(
    'SELECT key, value FROM settings WHERE user_id IS NULL AND key = ANY($1::text[])',
    [keys]
  );
  const map = {};
  result.rows.forEach((row) => {
    map[row.key] = row.value;
  });
  const defaultCommission = toNumber(map.affiliateDefaultCommission) ?? 25;
  const minPayout = toNumber(map.affiliateMinPayout) ?? 100;
  return {
    default_commission: defaultCommission,
    min_payout: minPayout
  };
}

async function getSubscriptionState(client, userId) {
  const result = await client.query(
    `SELECT status, end_date
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return 'none';

  const row = result.rows[0];
  const status = String(row.status || '').toLowerCase();
  const endDate = row.end_date ? new Date(row.end_date) : null;
  const now = Date.now();

  if (status === 'active') {
    if (endDate && Number.isFinite(endDate.getTime()) && endDate.getTime() <= now) return 'expired';
    return 'active';
  }
  if (status === 'canceled') return 'canceled';
  return 'expired';
}

router.get('/me', async (req, res, next) => {
  try {
    const userId = req.user.id;
    await ensureAffiliateProfile(db, userId);

    const [profileResult, settings, subscriptionState] = await Promise.all([
      db.query(
        `SELECT user_id, custom_commission, pix_key, total_earned, balance_available, balance_reserved, created_at, updated_at
         FROM affiliates_profiles
         WHERE user_id = $1`,
        [userId]
      ),
      getAffiliateSettings(db),
      getSubscriptionState(db, userId)
    ]);

    const profile = profileResult.rows[0];
    const customCommission = toNumber(profile?.custom_commission);
    const effectiveCommission = customCommission ?? settings.default_commission;

    const frontendUrl = process.env.FRONTEND_URL || 'https://duovet.app';
    const affiliateLink = `${frontendUrl.replace(/\/$/, '')}/register?ref=${userId}`;

    res.json({
      subscription_state: subscriptionState,
      affiliate_link: affiliateLink,
      settings,
      effective_commission: effectiveCommission,
      profile: {
        user_id: profile.user_id,
        custom_commission: customCommission,
        pix_key: profile.pix_key || '',
        total_earned: toNumber(profile.total_earned) ?? 0,
        balance_available: toNumber(profile.balance_available) ?? 0,
        balance_reserved: toNumber(profile.balance_reserved) ?? 0
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/me/pix', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pixKey = String(req.body?.pix_key || '').trim();
    await ensureAffiliateProfile(db, userId);
    const result = await db.query(
      `UPDATE affiliates_profiles
       SET pix_key = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING user_id, pix_key, custom_commission, total_earned, balance_available, balance_reserved`,
      [pixKey, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/me/referrals', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT r.id, r.referred_at, r.status, r.commission_value, u.name AS referred_name, u.created_at AS referred_created_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.affiliate_id = $1
       ORDER BY r.referred_at DESC`,
      [userId]
    );
    res.json(
      (result.rows || []).map((row) => ({
        id: row.id,
        referred_name: maskFirstName(row.referred_name),
        referred_at: row.referred_at || row.referred_created_at,
        status: row.status,
        commission_value: toNumber(row.commission_value) ?? 0
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/me/payouts', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT id, amount, pix_key, status, requested_at, processed_at, note
       FROM payout_requests
       WHERE user_id = $1
       ORDER BY requested_at DESC`,
      [userId]
    );
    res.json(
      (result.rows || []).map((row) => ({
        id: row.id,
        amount: toNumber(row.amount) ?? 0,
        pix_key: row.pix_key || '',
        status: row.status,
        requested_at: row.requested_at,
        processed_at: row.processed_at,
        note: row.note || ''
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/me/payouts', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    await client.query('BEGIN');
    await ensureAffiliateProfile(client, userId);

    const settings = await getAffiliateSettings(client);
    const profileResult = await client.query(
      `SELECT user_id, pix_key, balance_available, balance_reserved
       FROM affiliates_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );
    const profile = profileResult.rows[0];
    const available = toNumber(profile.balance_available) ?? 0;
    const requestedAmount = toNumber(req.body?.amount) ?? available;
    const pixKey = String(profile.pix_key || '').trim();

    if (!pixKey) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Informe uma chave PIX para solicitar saque.' });
    }
    if (!requestedAmount || requestedAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Valor inválido para saque.' });
    }
    if (requestedAmount < settings.min_payout) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `O valor mínimo para saque é R$ ${settings.min_payout.toFixed(2)}.` });
    }
    if (requestedAmount > available) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }

    const updated = await client.query(
      `UPDATE affiliates_profiles
       SET balance_available = balance_available - $1,
           balance_reserved = balance_reserved + $1,
           updated_at = NOW()
       WHERE user_id = $2
         AND balance_available >= $1
       RETURNING user_id, balance_available, balance_reserved`,
      [requestedAmount, userId]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }

    const requestResult = await client.query(
      `INSERT INTO payout_requests (user_id, amount, pix_key, status, requested_at)
       VALUES ($1, $2, $3, 'requested', NOW())
       RETURNING id, user_id, amount, pix_key, status, requested_at`,
      [userId, requestedAmount, pixKey]
    );

    await client.query('COMMIT');
    res.status(201).json(requestResult.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    next(err);
  } finally {
    client.release();
  }
});

router.get('/admin/payout-requests', adminMiddleware, async (req, res, next) => {
  try {
    const status = String(req.query?.status || 'requested');
    const result = await db.query(
      `SELECT pr.id, pr.user_id, pr.amount, pr.pix_key, pr.status, pr.requested_at, pr.processed_at, pr.note,
              u.name, u.email
       FROM payout_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.status = $1
       ORDER BY pr.requested_at ASC`,
      [status]
    );
    res.json(
      (result.rows || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        email: row.email,
        amount: toNumber(row.amount) ?? 0,
        pix_key: row.pix_key || '',
        status: row.status,
        requested_at: row.requested_at,
        processed_at: row.processed_at,
        note: row.note || ''
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.post('/admin/payout-requests/:id/complete', adminMiddleware, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const requestId = parseInt(req.params.id, 10);
    if (!Number.isFinite(requestId)) return res.status(400).json({ error: 'ID inválido' });

    await client.query('BEGIN');
    const requestResult = await client.query(
      `SELECT id, user_id, amount, status
       FROM payout_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    const requestRow = requestResult.rows[0];
    if (!requestRow || requestRow.status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitação não encontrada ou não está pendente.' });
    }

    const amount = toNumber(requestRow.amount) ?? 0;
    const updatedProfile = await client.query(
      `UPDATE affiliates_profiles
       SET balance_reserved = balance_reserved - $1,
           updated_at = NOW()
       WHERE user_id = $2
         AND balance_reserved >= $1
       RETURNING user_id, balance_available, balance_reserved`,
      [amount, requestRow.user_id]
    );
    if (updatedProfile.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo reservado insuficiente para dar baixa.' });
    }

    const updatedRequest = await client.query(
      `UPDATE payout_requests
       SET status = 'completed',
           processed_at = NOW(),
           processed_by = $2
       WHERE id = $1
       RETURNING id, user_id, amount, status, requested_at, processed_at`,
      [requestId, req.user.id]
    );

    await client.query('COMMIT');
    res.json(updatedRequest.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    next(err);
  } finally {
    client.release();
  }
});

router.post('/admin/payout-requests/:id/reject', adminMiddleware, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const requestId = parseInt(req.params.id, 10);
    if (!Number.isFinite(requestId)) return res.status(400).json({ error: 'ID inválido' });
    const note = String(req.body?.note || '').trim();

    await client.query('BEGIN');
    const requestResult = await client.query(
      `SELECT id, user_id, amount, status
       FROM payout_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    const requestRow = requestResult.rows[0];
    if (!requestRow || requestRow.status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitação não encontrada ou não está pendente.' });
    }

    const amount = toNumber(requestRow.amount) ?? 0;
    const updatedProfile = await client.query(
      `UPDATE affiliates_profiles
       SET balance_available = balance_available + $1,
           balance_reserved = balance_reserved - $1,
           updated_at = NOW()
       WHERE user_id = $2
         AND balance_reserved >= $1
       RETURNING user_id, balance_available, balance_reserved`,
      [amount, requestRow.user_id]
    );
    if (updatedProfile.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo reservado insuficiente para rejeitar.' });
    }

    const updatedRequest = await client.query(
      `UPDATE payout_requests
       SET status = 'rejected',
           processed_at = NOW(),
           processed_by = $2,
           note = $3
       WHERE id = $1
       RETURNING id, user_id, amount, status, requested_at, processed_at, note`,
      [requestId, req.user.id, note]
    );

    await client.query('COMMIT');
    res.json(updatedRequest.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    next(err);
  } finally {
    client.release();
  }
});

router.put('/admin/users/:id/custom-commission', adminMiddleware, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: 'ID inválido' });
    const commissionRaw = req.body?.custom_commission;
    const commission = commissionRaw === null || commissionRaw === '' || commissionRaw === undefined ? null : toNumber(commissionRaw);
    if (commission !== null && (commission < 0 || commission > 100)) {
      return res.status(400).json({ error: 'Comissão deve estar entre 0 e 100.' });
    }

    await ensureAffiliateProfile(db, userId);
    const result = await db.query(
      `UPDATE affiliates_profiles
       SET custom_commission = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING user_id, custom_commission, pix_key, total_earned, balance_available, balance_reserved`,
      [commission, userId]
    );
    res.json({
      ...result.rows[0],
      custom_commission: commission
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users/:id/profile', adminMiddleware, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: 'ID inválido' });
    await ensureAffiliateProfile(db, userId);
    const result = await db.query(
      `SELECT user_id, custom_commission, pix_key, total_earned, balance_available, balance_reserved
       FROM affiliates_profiles
       WHERE user_id = $1`,
      [userId]
    );
    const profile = result.rows[0];
    res.json({
      user_id: profile.user_id,
      custom_commission: toNumber(profile.custom_commission),
      pix_key: profile.pix_key || '',
      total_earned: toNumber(profile.total_earned) ?? 0,
      balance_available: toNumber(profile.balance_available) ?? 0,
      balance_reserved: toNumber(profile.balance_reserved) ?? 0
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/performance/top', adminMiddleware, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query?.limit || '10', 10)));
    const result = await db.query(
      `SELECT u.id, u.name, u.email, ap.total_earned
       FROM affiliates_profiles ap
       JOIN users u ON u.id = ap.user_id
       ORDER BY ap.total_earned DESC
       LIMIT $1`,
      [limit]
    );
    res.json(
      (result.rows || []).map((row) => ({
        user_id: row.id,
        name: row.name,
        email: row.email,
        total_earned: toNumber(row.total_earned) ?? 0
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/admin/performance/conversions', adminMiddleware, async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query?.days || '30', 10)));
    const result = await db.query(
      `SELECT date_trunc('day', paid_at) AS date, COUNT(*)::int AS count
       FROM referrals
       WHERE status = 'paid'
         AND paid_at IS NOT NULL
         AND paid_at >= (NOW() - ($1::int * INTERVAL '1 day'))
       GROUP BY 1
       ORDER BY 1`,
      [days]
    );
    res.json(
      (result.rows || []).map((row) => ({
        date: row.date,
        count: Number(row.count) || 0
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
