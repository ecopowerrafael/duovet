// Rotas de autenticação JWT
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.BACKEND_URL || 'http://localhost:4000/api';
const EMAIL_TEMPLATE_DEFAULTS = {
  emailWelcomeEnabled: 'true',
  emailWelcomeSubject: 'Conta criada com sucesso - DuoVet',
  emailWelcomeBody: `<p>Olá {{veterinario_nome}},</p>
<p>Sua conta no DuoVet foi criada com sucesso.</p>
<p>Agora você já pode acessar a plataforma e iniciar a gestão dos seus atendimentos.</p>
<p><a href="{{login_url}}">{{login_url}}</a></p>
<p>Se você não reconhece este cadastro, entre em contato com o suporte.</p>`,
  emailResetPasswordEnabled: 'true',
  emailResetPasswordSubject: 'Recuperação de Senha - DuoVet',
  emailResetPasswordBody: `<p>Olá {{veterinario_nome}},</p>
<p>Você solicitou a recuperação de sua senha no DuoVet.</p>
<p>Clique no link abaixo para criar uma nova senha:</p>
<p><a href="{{reset_url}}">{{reset_url}}</a></p>
<p>Este link expira em 1 hora.</p>
<p>Se você não solicitou isso, ignore este e-mail.</p>`
};

let activeGoogleConfig = null;

async function resolveGoogleConfig() {
  const fallback = {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `${API_URL}/auth/google/callback`
  };
  try {
    const result = await db.query(
      `SELECT s.key, s.value, CASE WHEN s.user_id IS NULL THEN 1 ELSE 0 END AS priority
       FROM settings s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.key IN ('googleClientId','googleClientSecret','redirectUri')
         AND (s.user_id IS NULL OR u.email = 'admin@duovet.app')
       ORDER BY priority ASC`
    );
    const map = {};
    result.rows.forEach((row) => {
      if (!map[row.key]) {
        map[row.key] = row.value;
      }
    });
    return {
      clientID: map.googleClientId || fallback.clientID,
      clientSecret: map.googleClientSecret || fallback.clientSecret,
      callbackURL: map.redirectUri || fallback.callbackURL
    };
  } catch (err) {
    return fallback;
  }
}

async function googleVerify(accessToken, refreshToken, profile, cb) {
  try {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = result.rows[0];
    const tokenExpiry = new Date(Date.now() + 3500 * 1000);

    if (!user) {
      const resultInsert = await db.query(
        `INSERT INTO users (
          email, password, name, created_at, status, 
          google_access_token, google_refresh_token, google_token_expiry
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7) RETURNING *`,
        [
          email, 'google_auth', name, 'trial',
          accessToken, refreshToken || null, tokenExpiry
        ]
      );
      user = resultInsert.rows[0];
    } else {
      const updateParams = [accessToken, tokenExpiry, email];
      let query = 'UPDATE users SET google_access_token = $1, google_token_expiry = $2';

      if (refreshToken) {
        query += ', google_refresh_token = $4';
        updateParams.push(refreshToken);
      }

      query += ' WHERE email = $3 RETURNING *';
      const resultUpdate = await db.query(query, updateParams);
      user = resultUpdate.rows[0];
    }

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status
    }, JWT_SECRET, { expiresIn: '8h' });

    return cb(null, { user, token });
  } catch (err) {
    return cb(err);
  }
}

async function ensureGoogleStrategy() {
  const config = await resolveGoogleConfig();
  if (!config.clientID || !config.clientSecret) return false;
  const changed =
    !activeGoogleConfig ||
    activeGoogleConfig.clientID !== config.clientID ||
    activeGoogleConfig.clientSecret !== config.clientSecret ||
    activeGoogleConfig.callbackURL !== config.callbackURL;
  if (changed) {
    if (passport._strategies.google) {
      passport.unuse('google');
    }
    passport.use(new GoogleStrategy({
      clientID: config.clientID,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackURL
    }, googleVerify));
    activeGoogleConfig = config;
  }
  return true;
}

// Rotas Google
router.get('/google', async (req, res, next) => {
  const ready = await ensureGoogleStrategy();
  if (!ready) return res.status(500).json({ error: 'Google Auth not configured' });
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

router.get('/google/calendar', async (req, res, next) => {
  const ready = await ensureGoogleStrategy();
  if (!ready) return res.status(500).json({ error: 'Google Auth not configured' });
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.events'],
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true
  })(req, res, next);
});

router.get('/google/callback', async (req, res, next) => {
  const ready = await ensureGoogleStrategy();
  if (!ready) return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login?error=google_failed`, session: false })(req, res, () => {
    res.redirect(`${FRONTEND_URL}/auth-callback?token=${req.user.token}`);
  });
});

// Integração real com PostgreSQL
// Remove local Pool definition


// Seed Admin User
async function ensureAdminUser() {
  const email = 'admin@duovet.app';
  try {
    const res = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    const password = '2705#Data';
    const hash = await bcrypt.hash(password, 8);
    
    if (res.rows.length === 0) {
      console.log('Admin user not found. Creating...');
      const name = 'Administrador';
      const createdAt = new Date();
      // Ensure users table exists first? It should.
      await db.query(
        'INSERT INTO users (email, password, name, created_at, status) VALUES ($1, $2, $3, $4, $5)',
        [email, hash, name, createdAt, 'active']
      );
      console.log('Admin user created successfully.');
    } else {
      console.log('Admin user found. Updating credentials...');
      // Update password to match user request
      await db.query('UPDATE users SET password = $1, status = $2 WHERE email = $3', [hash, 'active', email]);
      console.log('Admin user updated.');
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}
// Run seed on load
ensureAdminUser();

const Joi = require('joi');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required()
});

// Helper para obter configurações de SMTP
async function getSmtpConfig() {
  const result = await db.query("SELECT key, value FROM settings WHERE user_id IS NULL AND key LIKE 'smtp_%'");
  const config = {};
  result.rows.forEach(r => { config[r.key] = r.value; });
  
  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    return null;
  }

  return {
    host: config.smtp_host,
    port: parseInt(config.smtp_port) || 587,
    secure: config.smtp_secure === 'true',
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    },
    from: config.smtp_from || config.smtp_user
  };
}

async function sendEmail({ to, subject, html }) {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) {
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth
  });
  await transporter.sendMail({
    to,
    from: smtpConfig.from,
    subject,
    html
  });
  return { sent: true };
}

function renderTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

async function getTemplatedEmailContent(templateType, variables = {}) {
  const templates = {
    welcome: {
      enabledKey: 'emailWelcomeEnabled',
      subjectKey: 'emailWelcomeSubject',
      bodyKey: 'emailWelcomeBody'
    },
    reset_password: {
      enabledKey: 'emailResetPasswordEnabled',
      subjectKey: 'emailResetPasswordSubject',
      bodyKey: 'emailResetPasswordBody'
    }
  };
  const selectedTemplate = templates[templateType];
  if (!selectedTemplate) {
    return { enabled: false, subject: '', html: '' };
  }
  const keys = [selectedTemplate.enabledKey, selectedTemplate.subjectKey, selectedTemplate.bodyKey];
  const result = await db.query(
    'SELECT key, value FROM settings WHERE user_id IS NULL AND key = ANY($1::text[])',
    [keys]
  );
  const values = {};
  result.rows.forEach((row) => {
    values[row.key] = row.value;
  });
  const enabled = (values[selectedTemplate.enabledKey] ?? EMAIL_TEMPLATE_DEFAULTS[selectedTemplate.enabledKey]) === 'true';
  const subjectTemplate = values[selectedTemplate.subjectKey] ?? EMAIL_TEMPLATE_DEFAULTS[selectedTemplate.subjectKey];
  const bodyTemplate = values[selectedTemplate.bodyKey] ?? EMAIL_TEMPLATE_DEFAULTS[selectedTemplate.bodyKey];
  return {
    enabled,
    subject: renderTemplate(subjectTemplate, variables),
    html: renderTemplate(bodyTemplate, variables)
  };
}

async function sendTemplatedEmail({ to, templateType, variables = {} }) {
  const content = await getTemplatedEmailContent(templateType, variables);
  if (!content.enabled) {
    return { sent: false, reason: 'template_disabled' };
  }
  return sendEmail({ to, subject: content.subject, html: content.html });
}

// Endpoint de registro
router.post('/register', async (req, res, next) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { email, password, name } = req.body;
  try {
    // Verifica se usuário já existe
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Usuário já cadastrado' });
    const hash = await bcrypt.hash(password, 8);
    const createdAt = new Date();
    const result = await db.query(
      'INSERT INTO users (email, password, name, created_at, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name',
      [email, hash, name, createdAt, 'trial']
    );
    try {
      await sendTemplatedEmail({
        to: email,
        templateType: 'welcome',
        variables: {
          veterinario_nome: name || 'usuário',
          login_url: `${FRONTEND_URL}/login`
        }
      });
    } catch (emailErr) {
      console.error('Erro ao enviar e-mail de criação de conta:', emailErr?.message || emailErr);
    }
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

// Login
router.post('/login', async (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT id, email, password, name, created_at, status FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Senha inválida' });
    // Verifica trial expirado
    let status = user.status;
    if (status === 'trial') {
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      if (diffDays >= 15) {
        status = 'expired';
        await db.query('UPDATE users SET status = $1 WHERE id = $2', ['expired', user.id]);
      }
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, status }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, status } });
  } catch (err) {
    next(err);
  }
});

// Alterar própria senha
router.post('/change-password', authMiddleware, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Senhas atual e nova são obrigatórias' });
  
  try {
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    
    const hash = await bcrypt.hash(newPassword, 8);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Esqueci minha senha - solicitar token
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

  try {
    const result = await db.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const user = result.rows[0];

    const token = crypto.randomBytes(20).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hora

    await db.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [token, expiry, user.id]);

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    try {
      const emailResult = await sendTemplatedEmail({
        to: email,
        templateType: 'reset_password',
        variables: {
          veterinario_nome: user.name || 'usuário',
          reset_url: resetUrl
        }
      });
      if (emailResult.reason === 'template_disabled') {
        return res.status(503).json({ error: 'Template de recuperação de senha desativado no painel admin.' });
      }
      if (!emailResult.sent) {
        console.error('SMTP not configured. Reset token generated but email not sent:', token);
        return res.status(503).json({ error: 'Serviço de e-mail não configurado. Entre em contato com o suporte.' });
      }
    } catch (emailErr) {
      console.error('Erro ao enviar e-mail de recuperação de senha:', emailErr?.message || emailErr);
      return res.status(503).json({ error: 'Serviço de e-mail não configurado. Entre em contato com o suporte.' });
    }

    res.json({ message: 'E-mail de recuperação enviado' });
  } catch (err) {
    next(err);
  }
});

// Resetar senha usando token
router.post('/reset-password', async (req, res, next) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });

  try {
    const result = await db.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Token inválido ou expirado' });
    const user = result.rows[0];

    const hash = await bcrypt.hash(newPassword, 8);
    await db.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hash, user.id]
    );

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Middleware para proteger rotas
function shouldAllowExpiredRequest(req) {
  const url = String(req.originalUrl || req.url || '');
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET' && url.startsWith('/api/auth/me')) return true;
  if (method === 'GET' && url.startsWith('/api/settings')) {
    return String(req.query?.user_id || '') === 'null';
  }
  if (method === 'GET' && url.startsWith('/api/subscriptions')) return true;
  if (method === 'POST' && url.startsWith('/api/payments/stripe/checkout')) return true;

  return false;
}

function isTrialExpired(createdAt) {
  if (!createdAt) return false;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const trialDurationMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs >= trialDurationMs;
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  console.log('Auth Middleware: Header received:', auth ? 'Yes' : 'No');
  
  if (!auth) return res.status(401).json({ error: 'Token não enviado' });
  const [, token] = auth.split(' ');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth Middleware: Token decoded:', { id: decoded.id, status: decoded.status, email: decoded.email });

    const userResult = await db.query(
      'SELECT id, email, name, status, created_at FROM users WHERE id = $1',
      [decoded.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const dbUser = userResult.rows[0];

    let effectiveStatus = dbUser.status;
    if (effectiveStatus === 'trial' && isTrialExpired(dbUser.created_at)) {
      effectiveStatus = 'expired';
      await db.query('UPDATE users SET status = $1 WHERE id = $2', ['expired', dbUser.id]);
    }

    if (effectiveStatus === 'expired' && !shouldAllowExpiredRequest(req)) {
      console.log('Auth Middleware: User expired');
      return res.status(403).json({ error: 'Trial expirado. Assine para continuar.' });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      status: effectiveStatus
    };
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Exemplo de rota protegida
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, authMiddleware };
