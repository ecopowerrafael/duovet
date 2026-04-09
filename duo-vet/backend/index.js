require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const passport = require('passport');

app.use(passport.initialize());

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const jsonLimit = process.env.JSON_BODY_LIMIT || '10mb';
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// IMPORTANTE: raw body para o webhook do Stripe deve vir ANTES do express.json()
// O express.raw() consome o stream e seta req._body=true, impedindo que express.json() re-parse
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ limit: jsonLimit, extended: true }));

// Debug Middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

const db = require('./db');
const { ensureConsultancyChargeAgendaEvents } = require('./consultancy_charge_events');
const EMAIL_TEMPLATE_DEFAULTS = {
  emailConsultancyReminderEnabled: 'true',
  emailConsultancyReminderSubject: 'Lembrete de cobrança da consultoria - DuoVet',
  emailConsultancyReminderBody: `<p>Olá {{cliente_nome}},</p>
<p>Este é um lembrete de cobrança da sua consultoria técnica.</p>
<p><strong>Veterinário:</strong> {{veterinario_nome}}</p>
<p><strong>Propriedade:</strong> {{propriedade_nome}}</p>
<p><strong>Animal:</strong> {{animal_nome}}</p>
<p><strong>Vencimento:</strong> {{data_vencimento}}</p>
<p><strong>Valor:</strong> {{valor_cobranca}}</p>
<p>Em caso de dúvidas, responda este e-mail.</p>`
};

function renderTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

async function getConsultancyReminderTemplate(variables = {}) {
  const keys = ['emailConsultancyReminderEnabled', 'emailConsultancyReminderSubject', 'emailConsultancyReminderBody'];
  const result = await db.query(
    'SELECT key, value FROM settings WHERE user_id IS NULL AND key = ANY($1::text[])',
    [keys]
  );
  const values = {};
  result.rows.forEach((row) => {
    values[row.key] = row.value;
  });
  const enabled = (values.emailConsultancyReminderEnabled ?? EMAIL_TEMPLATE_DEFAULTS.emailConsultancyReminderEnabled) === 'true';
  const subjectTemplate = values.emailConsultancyReminderSubject ?? EMAIL_TEMPLATE_DEFAULTS.emailConsultancyReminderSubject;
  const bodyTemplate = values.emailConsultancyReminderBody ?? EMAIL_TEMPLATE_DEFAULTS.emailConsultancyReminderBody;
  return {
    enabled,
    subject: renderTemplate(subjectTemplate, variables),
    html: renderTemplate(bodyTemplate, variables)
  };
}

async function getSmtpConfig() {
  const result = await db.query("SELECT key, value FROM settings WHERE user_id IS NULL AND key LIKE 'smtp_%'");
  const config = {};
  result.rows.forEach((row) => {
    config[row.key] = row.value;
  });
  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    return null;
  }
  return {
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10) || 587,
    secure: config.smtp_secure === 'true',
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    },
    from: config.smtp_from || config.smtp_user
  };
}

async function sendClientPaymentReminderEmail({ to, clientName, propertyName, amountLabel, dueDateLabel, veterinarianName, animalName }) {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) return { sent: false, reason: 'smtp_not_configured' };
  const emailContent = await getConsultancyReminderTemplate({
    veterinario_nome: veterinarianName || '',
    cliente_nome: clientName || 'cliente',
    animal_nome: animalName || '',
    propriedade_nome: propertyName || 'Propriedade',
    valor_cobranca: amountLabel || 'A combinar',
    data_vencimento: dueDateLabel || ''
  });
  if (!emailContent.enabled) return { sent: false, reason: 'template_disabled' };
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth
  });
  await transporter.sendMail({
    to,
    from: smtpConfig.from,
    subject: emailContent.subject,
    html: emailContent.html
  });
  return { sent: true };
}

async function runConsultancyChargeReminderSweep() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const { rows: consultancies } = await db.query(
    `
      SELECT
        c.id,
        c.client_id,
        c.property_id,
        c.payment_date,
        c.value,
        c.status,
        c.created_by,
        cl.name AS client_name,
        cl.email AS client_email,
        p.name AS property_name,
        u.name AS veterinarian_name
      FROM consultancies c
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN properties p ON p.id = c.property_id
      LEFT JOIN users u ON LOWER(u.email) = LOWER(c.created_by)
      WHERE c.status = 'ativa'
        AND c.payment_date IS NOT NULL
        AND c.created_by IS NOT NULL
    `
  );

  for (const consultancy of consultancies) {
    await ensureConsultancyChargeAgendaEvents(consultancy, { monthsAhead: 12, fromDate: now });

    const paymentDate = new Date(consultancy.payment_date);
    if (Number.isNaN(paymentDate.getTime())) continue;
    const effectiveDay = Math.min(paymentDate.getDate(), daysInMonth);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), effectiveDay);
    const preReminderDate = new Date(dueDate);
    preReminderDate.setDate(dueDate.getDate() - 5);
    const dueDateLabel = dueDate.toLocaleDateString('pt-BR');
    const amountLabel = consultancy.value ? `R$ ${Number(consultancy.value).toFixed(2)}` : '';

    if (today.getTime() === preReminderDate.getTime()) {
      const existingPreReminder = await db.query(
        `
          SELECT 1
          FROM notifications
          WHERE type = $1
            AND related_entity_type = 'consultancy'
            AND related_entity_id = $2
            AND LOWER(created_by) = LOWER($3)
            AND date_trunc('month', created_at) = date_trunc('month', NOW())
          LIMIT 1
        `,
        ['pagamento_pre_aviso', consultancy.id, consultancy.created_by]
      );
      if (existingPreReminder.rows.length === 0) {
        const clientName = consultancy.client_name || 'Cliente';
        const propertyName = consultancy.property_name || 'Propriedade';
        const preTitle = 'Cobrança de consultoria em 5 dias';
        const preDescription = `Cobrança da consultoria para ${clientName} (${propertyName}) em ${dueDateLabel}${amountLabel ? ` (${amountLabel})` : ''}.`;
        await db.query(
          `
            INSERT INTO notifications (type, title, description, status, created_by, related_entity_type, related_entity_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `,
          ['pagamento_pre_aviso', preTitle, preDescription, 'unread', consultancy.created_by, 'consultancy', consultancy.id]
        );
        if (consultancy.client_email) {
          try {
            await sendClientPaymentReminderEmail({
              to: consultancy.client_email,
              clientName,
              propertyName,
              amountLabel,
              dueDateLabel,
              veterinarianName: consultancy.veterinarian_name || '',
              animalName: ''
            });
          } catch (emailError) {
            console.error('[CONSULTANCY PRE REMINDER EMAIL ERROR]', emailError?.message || emailError);
          }
        }
      }
    }

    if (now.getDate() < effectiveDay) continue;

    const existing = await db.query(
      `
        SELECT 1
        FROM notifications
        WHERE type = $1
          AND related_entity_type = 'consultancy'
          AND related_entity_id = $2
          AND LOWER(created_by) = LOWER($3)
          AND date_trunc('month', created_at) = date_trunc('month', NOW())
        LIMIT 1
      `,
      ['pagamento_pendente', consultancy.id, consultancy.created_by]
    );
    if (existing.rows.length > 0) continue;

    const clientName = consultancy.client_name || 'Cliente';
    const propertyName = consultancy.property_name || 'Propriedade';
    const amountLabelSuffix = consultancy.value ? ` (R$ ${Number(consultancy.value).toFixed(2)})` : '';
    const title = 'Cobrança de consultoria';
    const description = `Hoje é dia de cobrança da consultoria para ${clientName} (${propertyName})${amountLabelSuffix}.`;

    await db.query(
      `
        INSERT INTO notifications (type, title, description, status, created_by, related_entity_type, related_entity_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      ['pagamento_pendente', title, description, 'unread', consultancy.created_by, 'consultancy', consultancy.id]
    );
  }
}

db.pool.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');
    // Setup tables
    require('./setup_full_db')();
    // Run migrations
    require('./migrate_db')();
    // Run lot migration
    require('./migrate_lots');
    // Run Google Calendar migration
    require('./migrate_google_calendar')();
  })
  .catch(err => console.error('PostgreSQL connection error:', err));

// Legacy admin routes support
app.use('/admin', express.static(path.join(__dirname, '../dist')));

// Rotas de autenticação
const { router: authRouter, authMiddleware } = require('./auth');
app.use('/api/auth', authRouter);

// Funções customizadas
app.use('/api/pdf', require('./pdf'));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'API online', version: '2.0.0' });
});

app.get('/api/version', (req, res) => {
  res.json({ version: '2.0.0', timestamp: new Date().toISOString() });
});

// Entidades principais
app.use('/api/clients', require('./clients'));
app.use('/api/animals', require('./animals'));
app.use('/api/lots', require('./lots'));
app.use('/api/properties', require('./properties'));
app.use('/api/appointments', require('./appointments'));
app.use('/api/events', require('./events'));
app.use('/api/prescriptions', require('./prescriptions'));
app.use('/api/protocols', require('./protocols'));
app.use('/api/vetprofiles', require('./vetprofiles'));
app.use('/api/vet-profile', require('./vetprofiles'));
app.use('/api/inventory', require('./inventory'));
app.use('/api', require('./reproductive_andrological'));

// Financeiro e Contratos
app.use('/api/expenses', require('./expenses'));
app.use('/api/payments', require('./payments'));
app.use('/api/invoices', require('./invoices'));
app.use('/api/contracts', require('./contracts'));
app.use('/api/consultancies', require('./consultancies'));
app.use('/api/subscriptions', require('./subscriptions'));

// Sistema e Utilidades
app.use('/api/users', require('./users'));
app.use('/api/settings', require('./settings'));
app.use('/api/notifications', require('./notifications'));
app.use('/api/tickets', require('./tickets'));
app.use('/api/google-calendar', require('./google_calendar').router);
app.use('/api/utils', require('./utils'));
app.use('/api/upload', require('./upload'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.url,
    method: req.method
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
  setTimeout(() => runConsultancyChargeReminderSweep().catch(() => {}), 7000);
  setInterval(() => runConsultancyChargeReminderSweep().catch(() => {}), 6 * 60 * 60 * 1000);
});
