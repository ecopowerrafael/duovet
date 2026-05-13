import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appointmentId, clientPhone, clientName } = await req.json();

    if (!appointmentId || !clientPhone) {
      return Response.json({ error: 'appointmentId and clientPhone are required' }, { status: 400 });
    }

    // Fetch appointment data
    const appointments = await base44.asServiceRole.entities.Appointment.filter({ id: appointmentId });
    const appointment = appointments[0];

    if (!appointment) {
      return Response.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Fetch related data
    const clients = await base44.asServiceRole.entities.Client.filter({ id: appointment.client_id });
    const client = clients[0];

    const properties = await base44.asServiceRole.entities.Property.filter({ id: appointment.property_id });
    const property = properties[0];

    const animals = await base44.asServiceRole.entities.Animal.filter({ 
      id: { $in: appointment.animal_ids || [] } 
    });

    const vetProfiles = await base44.asServiceRole.entities.VetProfile.list();
    const vetProfile = vetProfiles[0];

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header background
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(15, 50, pageWidth - 15, 50);

    // Logo (if exists)
    let logoX = 15;
    if (vetProfile?.logo_url) {
      try {
        const logoData = await fetch(vetProfile.logo_url)
          .then(r => r.blob())
          .then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          }));
        doc.addImage(logoData, 'PNG', 15, 8, 20, 20);
        logoX = 40;
      } catch (e) {
        // Continue without logo
      }
    }

    // Vet Info (left side)
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(vetProfile?.full_name || vetProfile?.fantasy_name || 'DuoVet', logoX, 16);

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    if (vetProfile?.crmv) {
      doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, logoX, 23);
    }
    if (vetProfile?.phone) {
      doc.text(`Tel: ${vetProfile.phone}`, logoX, 28);
    }
    if (vetProfile?.email) {
      doc.text(`Email: ${vetProfile.email}`, logoX, 33);
    }

    // Title (right side)
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Relatório de Atendimento', pageWidth - 15, 20, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Documento Nº ${appointment.id?.slice(-8).toUpperCase()}`, pageWidth - 15, 28, { align: 'right' });

    // Content starts
    let y = 62;

    // Identification Section
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('IDENTIFICAÇÃO', 15, y);
    y += 8;

    const colWidth = (pageWidth - 40) / 2;

    // Client Column
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('CLIENTE', 15, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(client?.name || '-', 15, y);
    y += 4;
    if (client?.document) {
      doc.setTextColor(100, 100, 100);
      doc.text(`CPF/CNPJ: ${client.document}`, 15, y);
      y += 4;
    }
    if (client?.phone) {
      doc.text(`Tel: ${client.phone}`, 15, y);
      y += 4;
    }

    // Appointment Column
    let yRight = 70;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('ATENDIMENTO', 15 + colWidth, yRight);
    yRight += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    
    const dateStr = new Date(appointment.date).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const timeStr = new Date(appointment.date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    doc.text(`Data: ${dateStr} às ${timeStr}`, 15 + colWidth, yRight);
    yRight += 4;

    const typeLabels = {
      clinico: 'Clínico',
      reprodutivo: 'Reprodutivo',
      cirurgico: 'Cirúrgico',
      sanitario: 'Sanitário',
      preventivo: 'Preventivo',
      consultoria: 'Consultoria'
    };
    doc.text(`Tipo: ${typeLabels[appointment.type] || appointment.type}`, 15 + colWidth, yRight);
    yRight += 4;
    
    if (property) {
      doc.text(`Propriedade: ${property.name}`, 15 + colWidth, yRight);
      yRight += 4;
      if (property.city && property.state) {
        doc.text(`Local: ${property.city} - ${property.state}`, 15 + colWidth, yRight);
        yRight += 4;
      }
    }

    y = Math.max(y, yRight) + 12;

    // Animals Section
    if (animals.length > 0) {
      doc.setDrawColor(240, 240, 240);
      doc.setFillColor(250, 250, 250);
      doc.rect(15, y - 5, pageWidth - 30, 5 + (animals.length * 4), 'FD');
      y += 2;

      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('ANIMAIS ATENDIDOS', 18, y);
      y += 5;

      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
      animals.forEach(animal => {
        const animalInfo = `${animal.name} • ${animal.species}${animal.breed ? ' • ' + animal.breed : ''}${animal.identification ? ' • ID: ' + animal.identification : ''}`;
        doc.text(animalInfo, 18, y);
        y += 4;
      });
      y += 6;
    }

    // Clinical Section
    if (appointment.symptoms || appointment.diagnosis) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('AVALIAÇÃO CLÍNICA', 15, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);

      if (appointment.symptoms) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Sintomas:', 15, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(appointment.symptoms, pageWidth - 30);
        doc.text(lines, 15, y);
        y += lines.length * 3 + 3;
      }

      if (appointment.diagnosis) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Diagnóstico:', 15, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(appointment.diagnosis, pageWidth - 30);
        doc.text(lines, 15, y);
        y += lines.length * 3 + 3;
      }

      y += 5;
    }

    // Medications
    if (appointment.medications?.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('MEDICAMENTOS PRESCRITOS', 15, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      appointment.medications.forEach((med, idx) => {
        doc.text(`${idx + 1}. ${med.name}`, 15, y);
        y += 3;
        if (med.dosage) {
          doc.setTextColor(100, 100, 100);
          doc.text(`   Dosagem: ${med.dosage}`, 15, y);
          y += 3;
        }
        if (med.frequency) {
          doc.text(`   Frequência: ${med.frequency}`, 15, y);
          y += 3;
        }
        doc.setTextColor(40, 40, 40);
        y += 2;
      });
      y += 5;
    }

    // Financial Summary
    if (appointment.total_amount > 0) {
      doc.setDrawColor(220, 220, 220);
      doc.line(15, y, pageWidth - 15, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('RESUMO FINANCEIRO', 15, y);
      y += 7;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);

      if (appointment.total_procedures > 0) {
        doc.text('Procedimentos', 15, y);
        doc.text(`R$ ${(appointment.total_procedures).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 15, y, { align: 'right' });
        y += 4;
      }

      if (appointment.total_medications > 0) {
        doc.text('Medicamentos', 15, y);
        doc.text(`R$ ${(appointment.total_medications).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 15, y, { align: 'right' });
        y += 4;
      }

      if (appointment.displacement_cost > 0) {
        doc.text('Deslocamento', 15, y);
        doc.text(`R$ ${appointment.displacement_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 15, y, { align: 'right' });
        y += 4;
      }

      y += 2;
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);
      y += 5;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('TOTAL', 15, y);
      doc.text(`R$ ${(appointment.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 15, y, { align: 'right' });
      y += 8;
    }

    // Signature Section
    y = pageHeight - 35;
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;

    doc.setDrawColor(180, 180, 180);
    doc.line(15, y + 5, 80, y + 5);

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(vetProfile?.full_name || 'Veterinário Responsável', 15, y + 10);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (vetProfile?.crmv) {
      doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, 15, y + 14);
    }

    // Footer
    const footerY = pageHeight - 8;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    const now = new Date();
    const dateStr2 = now.toLocaleDateString('pt-BR');
    const timeStr2 = now.toLocaleTimeString('pt-BR');
    doc.text(`Documento gerado em ${dateStr2} às ${timeStr2} via DuoVet`, 15, footerY);

    // Get PDF as ArrayBuffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    
    // Create File from Blob
    const fileName = `relatorio_atendimento_${appointment.id?.slice(-6)}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    
    // Upload PDF to public storage using Base44 integration
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
    
    if (!uploadResult.file_url) {
      throw new Error('Failed to upload PDF');
    }
    
    const pdfUrl = uploadResult.file_url;

    // Format WhatsApp message with PDF link
    const msg = `Olá ${clientName || 'Cliente'}! 👋\n\nSegue o relatório do atendimento veterinário realizado.\n\n📄 *Baixar Relatório PDF:*\n${pdfUrl}\n\nQualquer dúvida, fico à disposição! 🩺`;

    // Clean phone number and create WhatsApp URL
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const whatsappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msg)}`;

    return Response.json({
      success: true,
      pdfUrl,
      whatsappUrl,
      message: msg,
      phone: clientPhone
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});