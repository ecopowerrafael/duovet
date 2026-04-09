import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appointmentId } = await req.json();

    // Buscar o atendimento
    const appointment = await base44.entities.Appointment.get(appointmentId);

    if (!appointment || !appointment.needs_return || !appointment.return_date) {
      return Response.json({ error: 'Appointment does not have return scheduled' }, { status: 400 });
    }

    // Buscar dados relacionados
    const client = await base44.entities.Client.get(appointment.client_id);
    const animals = appointment.animal_ids?.length > 0 
      ? await Promise.all(appointment.animal_ids.map(id => base44.entities.Animal.get(id)))
      : [];

    const returnDateTime = appointment.return_time 
      ? new Date(`${appointment.return_date}T${appointment.return_time}`)
      : new Date(`${appointment.return_date}T09:00:00`);

    const now = new Date();
    const animalNames = animals.map(a => a.name).join(', ');

    // Calcular datas das notificações
    const oneDayBefore = new Date(returnDateTime);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);

    const oneDayBeforeStart = new Date(oneDayBefore);
    oneDayBeforeStart.setHours(9, 0, 0, 0);

    const oneDayBeforeEnd = new Date(oneDayBefore);
    oneDayBeforeEnd.setHours(23, 59, 59, 999);

    const morningOfReturn = new Date(returnDateTime);
    morningOfReturn.setHours(8, 0, 0, 0);

    const oneHourBefore = new Date(returnDateTime);
    oneHourBefore.setHours(returnDateTime.getHours() - 1);

    const notifications = [];

    // Notificação 24h antes
    if (now < oneDayBeforeEnd) {
      notifications.push({
        type: 'retorno',
        priority: 'media',
        title: 'Retorno agendado para amanhã',
        message: `Retorno de ${client.name}${animalNames ? ` - ${animalNames}` : ''} (${appointment.return_type})`,
        appointment_id: appointmentId,
        client_id: appointment.client_id,
        return_date: returnDateTime.toISOString(),
        action_url: `/AppointmentDetail?id=${appointmentId}`,
        metadata: {
          notification_type: '24h_before',
          scheduled_for: oneDayBeforeStart.toISOString()
        }
      });
    }

    // Notificação manhã do retorno
    if (now < morningOfReturn) {
      notifications.push({
        type: 'retorno',
        priority: 'alta',
        title: 'Retorno programado para hoje',
        message: `${client.name}${animalNames ? ` - ${animalNames}` : ''} (${appointment.return_type}) às ${appointment.return_time || '09:00'}`,
        appointment_id: appointmentId,
        client_id: appointment.client_id,
        return_date: returnDateTime.toISOString(),
        action_url: `/AppointmentDetail?id=${appointmentId}`,
        metadata: {
          notification_type: 'morning_of',
          scheduled_for: morningOfReturn.toISOString()
        }
      });
    }

    // Notificação 1h antes (se houver horário definido)
    if (appointment.return_time && now < oneHourBefore) {
      notifications.push({
        type: 'retorno',
        priority: 'alta',
        title: 'Retorno em 1 hora',
        message: `${client.name}${animalNames ? ` - ${animalNames}` : ''} (${appointment.return_type}) às ${appointment.return_time}`,
        appointment_id: appointmentId,
        client_id: appointment.client_id,
        return_date: returnDateTime.toISOString(),
        action_url: `/AppointmentDetail?id=${appointmentId}`,
        metadata: {
          notification_type: '1h_before',
          scheduled_for: oneHourBefore.toISOString()
        }
      });
    }

    // Criar as notificações
    const created = await Promise.all(
      notifications.map(notif => base44.asServiceRole.entities.Notification.create(notif))
    );

    return Response.json({
      success: true,
      notifications_created: created.length,
      appointment_id: appointmentId
    });

  } catch (error) {
    console.error('Error creating return notifications:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});