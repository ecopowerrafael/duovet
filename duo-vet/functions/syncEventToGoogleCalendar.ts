import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id } = await req.json();

    if (!event_id) {
      return Response.json({ error: 'event_id is required' }, { status: 400 });
    }

    // Buscar evento
    const events = await base44.entities.Event.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = events[0];

    // Buscar dados relacionados
    let clientName = '';
    let propertyName = '';
    
    if (event.client_id) {
      const clients = await base44.entities.Client.filter({ id: event.client_id });
      if (clients && clients.length > 0) {
        clientName = clients[0].name;
      }
    }

    if (event.property_id) {
      const properties = await base44.entities.Property.filter({ id: event.property_id });
      if (properties && properties.length > 0) {
        propertyName = properties[0].name;
      }
    }

    // Obter access token do Google Calendar
    let accessToken;
    try {
      accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
      if (!accessToken) {
        return Response.json({ 
          error: 'Google Calendar não está conectado. Configure a conexão nas configurações.' 
        }, { status: 400 });
      }
    } catch (tokenError) {
      return Response.json({ 
        error: 'Erro ao obter acesso ao Google Calendar. Verifique se está conectado nas configurações.',
        details: tokenError.message
      }, { status: 400 });
    }

    // Preparar descrição
    let description = event.notes || '';
    if (clientName) description += `\nCliente: ${clientName}`;
    if (propertyName) description += `\nPropriedade: ${propertyName}`;
    if (event.appointment_type) description += `\nTipo: ${event.appointment_type}`;

    // Preparar evento do Google Calendar
    const googleEvent = {
      summary: event.title,
      description: description,
      start: {
        dateTime: event.start_datetime,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: event.end_datetime,
        timeZone: 'America/Sao_Paulo',
      },
      location: event.location || '',
      colorId: event.event_type === 'atendimento' ? '10' : '7', // Verde para atendimentos
    };

    let googleResponse;

    if (event.google_event_id) {
      // Atualizar evento existente
      const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}`;
      googleResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      });
    } else {
      // Criar novo evento
      const createUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
      googleResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      });
    }

    if (!googleResponse.ok) {
      const errorData = await googleResponse.text();
      return Response.json({ 
        error: 'Failed to sync with Google Calendar',
        details: errorData 
      }, { status: 500 });
    }

    const googleEventData = await googleResponse.json();

    // Atualizar evento com google_event_id
    await base44.entities.Event.update(event_id, {
      google_event_id: googleEventData.id,
      is_synced: true,
      sync_pending: false,
    });

    return Response.json({ 
      success: true,
      google_event_id: googleEventData.id,
      htmlLink: googleEventData.htmlLink,
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});