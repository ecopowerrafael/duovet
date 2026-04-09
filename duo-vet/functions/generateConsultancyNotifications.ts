import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consultancies = await base44.entities.Consultancy.filter({
      created_by: user.email
    });

    const now = new Date();
    const notificationsToCreate = [];

    for (const consultancy of consultancies) {
      if (consultancy.status !== 'ativa') continue;

      const nextReturn = new Date(consultancy.next_return_date);

      // 1. Consultoria recorrente próxima (7 dias)
      if (nextReturn <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && nextReturn > now) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'consultoria_proxima',
          related_entity_id: consultancy.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'consultoria_proxima',
            priority: 'media',
            title: 'Consultoria recorrente próxima',
            description: `Consultoria agendada para ${nextReturn.toLocaleDateString('pt-BR')}`,
            related_entity_type: 'Consultancy',
            related_entity_id: consultancy.id,
            triggered_by: 'automatica',
            metadata: {
              nextReturnDate: consultancy.next_return_date,
              frequency: consultancy.frequency
            }
          });
        }
      }

      // 2. Consultoria sem registro técnico recente (30 dias)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (!consultancy.last_visit_date || new Date(consultancy.last_visit_date) < thirtyDaysAgo) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'consultoria_sem_registro',
          related_entity_id: consultancy.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'consultoria_sem_registro',
            priority: 'media',
            title: 'Consultoria sem visita recente',
            description: `Sem registro técnico há mais de 30 dias`,
            related_entity_type: 'Consultancy',
            related_entity_id: consultancy.id,
            triggered_by: 'automatica'
          });
        }
      }

      // 3. Consultoria sem relatório pendente
      if (consultancy.reports?.length === 0 || !consultancy.last_visit_date) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'consultoria_sem_relatorio',
          related_entity_id: consultancy.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'consultoria_sem_relatorio',
            priority: 'baixa',
            title: 'Relatório de consultoria pendente',
            description: `Gere o relatório técnico da consultoria`,
            related_entity_type: 'Consultancy',
            related_entity_id: consultancy.id,
            triggered_by: 'automatica'
          });
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      await base44.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({
      success: true,
      created: notificationsToCreate.length
    });
  } catch (error) {
    console.error('Error generating consultancy notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});