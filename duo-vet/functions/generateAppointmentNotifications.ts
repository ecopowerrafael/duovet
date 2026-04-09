import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todos os atendimentos do usuário
    const appointments = await base44.entities.Appointment.filter({
      created_by: user.email
    });

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);

    const notificationsToCreate = [];

    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.date);

      // 1. Atendimento agendado para hoje
      if (appointmentDate.toDateString() === now.toDateString() && appointmentDate > now) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'agenda_hoje',
          related_entity_id: appointment.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'agenda_hoje',
            priority: 'alta',
            title: 'Atendimento agendado para hoje',
            description: `Atendimento às ${appointmentDate.getHours().toString().padStart(2, '0')}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`,
            related_entity_type: 'Appointment',
            related_entity_id: appointment.id,
            triggered_by: 'automatica',
            metadata: {
              appointmentTime: appointmentDate.toISOString(),
              clientId: appointment.client_id
            }
          });
        }
      }

      // 2. Atendimento nas próximas 24h
      if (appointmentDate > now && appointmentDate < tomorrowEnd) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'agenda_proximas_24h',
          related_entity_id: appointment.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'agenda_proximas_24h',
            priority: 'alta',
            title: 'Atendimento nas próximas 24 horas',
            description: `Agendado para ${appointmentDate.toLocaleDateString('pt-BR')}`,
            related_entity_type: 'Appointment',
            related_entity_id: appointment.id,
            triggered_by: 'automatica',
            metadata: {
              appointmentTime: appointmentDate.toISOString()
            }
          });
        }
      }

      // 3. Atendimento com retorno pendente
      if (appointment.status === 'finalizado' && appointment.needs_return && !appointment.return_completed) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'atendimento_com_retorno',
          related_entity_id: appointment.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'atendimento_com_retorno',
            priority: 'media',
            title: 'Atendimento com retorno pendente',
            description: `Retorno agendado para ${new Date(appointment.return_date).toLocaleDateString('pt-BR')}`,
            related_entity_type: 'Appointment',
            related_entity_id: appointment.id,
            triggered_by: 'automatica',
            metadata: {
              returnDate: appointment.return_date
            }
          });
        }
      }

      // 4. Atendimento sem relatório gerado (após 2 dias)
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      if (
        appointment.status === 'finalizado' &&
        appointmentDate < twoDaysAgo &&
        !appointment.pdf_generated
      ) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'atendimento_sem_relatorio',
          related_entity_id: appointment.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'atendimento_sem_relatorio',
            priority: 'baixa',
            title: 'Relatório não gerado',
            description: `Atendimento de ${appointmentDate.toLocaleDateString('pt-BR')} sem relatório PDF`,
            related_entity_type: 'Appointment',
            related_entity_id: appointment.id,
            triggered_by: 'automatica'
          });
        }
      }

      // 5. Atendimento sem prescrição (se aplicável)
      if (
        appointment.status === 'finalizado' &&
        appointment.medications?.length > 0 &&
        appointment.type !== 'consultoria'
      ) {
        const existingNotif = await base44.entities.Notification.filter({
          created_by: user.email,
          type: 'atendimento_sem_prescricao',
          related_entity_id: appointment.id,
          status: { $ne: 'resolvida' }
        });

        if (existingNotif.length === 0) {
          notificationsToCreate.push({
            type: 'atendimento_sem_prescricao',
            priority: 'media',
            title: 'Prescrição não gerada',
            description: `Atendimento possui medicamentos prescritos sem prescrição formal`,
            related_entity_type: 'Appointment',
            related_entity_id: appointment.id,
            triggered_by: 'automatica'
          });
        }
      }
    }

    // Criar todas as notificações
    if (notificationsToCreate.length > 0) {
      await base44.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({
      success: true,
      created: notificationsToCreate.length
    });
  } catch (error) {
    console.error('Error generating notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});