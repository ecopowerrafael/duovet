// src/lib/googleCalendar.js
// Funções utilitárias para Google Calendar usando accessToken do usuário

/**
 * Lista eventos do Google Calendar do usuário autenticado
 * @param {string} accessToken Token OAuth do Google
 * @param {string} [calendarId='primary'] ID do calendário (default: principal)
 * @param {string} [timeMin] Data/hora inicial (ISO)
 * @param {string} [timeMax] Data/hora final (ISO)
 */
export async function listGoogleEvents(accessToken, calendarId = 'primary', timeMin, timeMax) {
  const params = new URLSearchParams();
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);
  params.append('singleEvents', 'true');
  params.append('orderBy', 'startTime');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Erro ao listar eventos do Google Calendar');
  return res.json();
}

/**
 * Cria um evento no Google Calendar do usuário
 * @param {string} accessToken Token OAuth do Google
 * @param {object} eventData Objeto de evento conforme API Google Calendar
 * @param {string} [calendarId='primary'] ID do calendário (default: principal)
 */
export async function createGoogleEvent(accessToken, eventData, calendarId = 'primary') {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });
  if (!res.ok) throw new Error('Erro ao criar evento no Google Calendar');
  return res.json();
}

/**
 * Edita um evento existente no Google Calendar do usuário
 * @param {string} accessToken Token OAuth do Google
 * @param {string} eventId ID do evento
 * @param {object} eventData Objeto de evento conforme API Google Calendar
 * @param {string} [calendarId='primary'] ID do calendário (default: principal)
 */
export async function updateGoogleEvent(accessToken, eventId, eventData, calendarId = 'primary') {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });
  if (!res.ok) throw new Error('Erro ao editar evento no Google Calendar');
  return res.json();
}
