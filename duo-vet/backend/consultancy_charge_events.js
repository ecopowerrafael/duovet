const db = require('./db');

const DEFAULT_HOUR = 9;
const DEFAULT_DURATION_MINUTES = 30;

function parsePaymentDate(paymentDate) {
  if (!paymentDate) return null;
  const parsed = new Date(paymentDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthDueDate(paymentDay, year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const effectiveDay = Math.min(paymentDay, daysInMonth);
  return new Date(year, monthIndex, effectiveDay, DEFAULT_HOUR, 0, 0, 0);
}

function getMarker(consultancyId) {
  return `[consultancy_charge:${consultancyId}]`;
}

async function removeUpcomingConsultancyChargeEvents({ consultancyId, createdBy, fromDate = new Date() }) {
  if (!consultancyId || !createdBy) return;

  const marker = getMarker(consultancyId);
  const rangeStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);

  await db.query(
    `
      DELETE FROM events
      WHERE event_type = 'consultoria'
        AND LOWER(created_by) = LOWER($1)
        AND notes LIKE $2
        AND start_datetime >= $3
    `,
    [createdBy, `%${marker}%`, rangeStart]
  );
}

async function ensureConsultancyChargeAgendaEvents(consultancy, options = {}) {
  if (!consultancy?.id || !consultancy?.created_by) return;

  const parsedPaymentDate = parsePaymentDate(consultancy.payment_date);
  const isActive = consultancy.status === 'ativa';

  if (!isActive || !parsedPaymentDate) {
    await removeUpcomingConsultancyChargeEvents({
      consultancyId: consultancy.id,
      createdBy: consultancy.created_by,
      fromDate: options.fromDate || new Date()
    });
    return;
  }

  const now = options.fromDate ? new Date(options.fromDate) : new Date();
  const monthsAhead = Number.isInteger(options.monthsAhead) ? options.monthsAhead : 12;
  const paymentDay = parsedPaymentDate.getDate();
  const marker = getMarker(consultancy.id);
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 1, 0, 0, 0, 0);

  const existingEventsRes = await db.query(
    `
      SELECT id, start_datetime
      FROM events
      WHERE event_type = 'consultoria'
        AND LOWER(created_by) = LOWER($1)
        AND notes LIKE $2
        AND start_datetime >= $3
        AND start_datetime < $4
    `,
    [consultancy.created_by, `%${marker}%`, rangeStart, rangeEnd]
  );

  const existingDayKeys = new Set(
    existingEventsRes.rows
      .map((row) => new Date(row.start_datetime))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map(dayKey)
  );

  let clientName = consultancy.client_name || null;
  let propertyName = consultancy.property_name || null;
  if (!clientName && consultancy.client_id) {
    const clientRes = await db.query('SELECT name FROM clients WHERE id = $1 LIMIT 1', [consultancy.client_id]);
    clientName = clientRes.rows[0]?.name || null;
  }
  if (!propertyName && consultancy.property_id) {
    const propertyRes = await db.query('SELECT name FROM properties WHERE id = $1 LIMIT 1', [consultancy.property_id]);
    propertyName = propertyRes.rows[0]?.name || null;
  }
  clientName = clientName || 'Cliente';
  propertyName = propertyName || 'Propriedade';
  const amountLabel = consultancy.value ? ` (R$ ${Number(consultancy.value).toFixed(2)})` : '';
  const title = `Cobrança consultoria: ${clientName} - ${propertyName}`;
  const baseNotes = `Lembrete automático de cobrança mensal da consultoria.${amountLabel}`;
  const finalNotes = `${baseNotes}\n${marker}`;

  for (let monthOffset = 0; monthOffset <= monthsAhead; monthOffset += 1) {
    const year = now.getFullYear();
    const monthIndex = now.getMonth() + monthOffset;
    const startDatetime = buildMonthDueDate(paymentDay, year, monthIndex);
    const endDatetime = new Date(startDatetime.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
    const eventDayKey = dayKey(startDatetime);

    if (existingDayKeys.has(eventDayKey)) continue;

    await db.query(
      `
        INSERT INTO events (
          title, event_type, start_datetime, end_datetime,
          client_id, property_id, notes, status, created_by, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
      [
        title,
        'consultoria',
        startDatetime,
        endDatetime,
        consultancy.client_id || null,
        consultancy.property_id || null,
        finalNotes,
        'agendado',
        consultancy.created_by
      ]
    );
  }
}

module.exports = {
  ensureConsultancyChargeAgendaEvents,
  removeUpcomingConsultancyChargeEvents
};
