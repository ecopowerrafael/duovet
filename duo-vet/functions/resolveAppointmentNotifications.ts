import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (!data) {
      return Response.json({ success: true, message: 'No data to process' });
    }

    // Se o atendimento foi finalizado ou o status mudou
    const statusChanged = old_data?.status !== data.status;

    if (statusChanged || data.status === 'finalizado') {
      // Buscar notificações relacionadas a este atendimento
      const notifications = await base44.asServiceRole.entities.Notification.filter({
        related_entity_id: data.id,
        related_entity_type: 'Appointment'
      });

      // Marcar como resolvidas
      for (const notification of notifications) {
        if (notification.status !== 'resolvida') {
          await base44.asServiceRole.entities.Notification.update(notification.id, {
            status: 'resolvida',
            resolved_at: new Date().toISOString()
          });
        }
      }
    }

    return Response.json({ success: true, resolved: notifications?.length || 0 });
  } catch (error) {
    console.error('Error resolving notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});