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

    // Se não tem google_event_id, não precisa deletar
    if (!event.google_event_id) {
      return Response.json({ 
        success: true,
        message: 'Event was not synced to Google Calendar'
      });
    }

    // Obter access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Deletar do Google Calendar
    const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}`;
    const googleResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!googleResponse.ok && googleResponse.status !== 404) {
      const errorData = await googleResponse.text();
      return Response.json({ 
        error: 'Failed to delete from Google Calendar',
        details: errorData 
      }, { status: 500 });
    }

    // Atualizar evento local
    await base44.entities.Event.update(event_id, {
      google_event_id: null,
      is_synced: false,
    });

    return Response.json({ 
      success: true,
      message: 'Event deleted from Google Calendar'
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});