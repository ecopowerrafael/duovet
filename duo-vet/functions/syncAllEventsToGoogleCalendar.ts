import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar eventos não sincronizados ou pendentes
    const allEvents = await base44.entities.Event.list();
    const eventsToSync = allEvents.filter(event => 
      !event.is_readonly && // Não sincronizar eventos somente leitura (externos)
      (!event.is_synced || event.sync_pending)
    );

    const results = {
      total: eventsToSync.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const event of eventsToSync) {
      try {
        // Chamar função de sincronização individual
        const syncResponse = await base44.functions.invoke('syncEventToGoogleCalendar', {
          event_id: event.id
        });

        if (syncResponse.data?.success) {
          results.synced++;
        } else {
          results.failed++;
          results.errors.push({
            event_id: event.id,
            title: event.title,
            error: syncResponse.data?.error || 'Unknown error'
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          event_id: event.id,
          title: event.title,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});