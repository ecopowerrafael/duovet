import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { offlineFetch } from '../../lib/offline';

export const generatePrescriptionPDF = async (appointment, client, animals, vetProfile, options = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const appointmentIdentifier = String(appointment?.id || appointment?._id || '');
  const appointmentShortCode = appointmentIdentifier ? appointmentIdentifier.slice(-6) : 'sem_id';
  const appointmentDate = appointment?.date ? new Date(appointment.date) : null;
  const appointmentDateLabel = appointmentDate && !Number.isNaN(appointmentDate.getTime())
    ? format(appointmentDate, 'dd/MM/yyyy', { locale: ptBR })
    : format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const loadImageForPdf = async (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('data:image/')) return url;
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return blobToDataUrl(blob);
    }
    // offlineFetch com responseType 'blob' já retorna um data URL
    const result = await offlineFetch(url, { responseType: 'blob' });
    return result && typeof result === 'string' && result.startsWith('data:image/') ? result : await blobToDataUrl(result);
  };

  const getImageFormat = (dataUrl) => {
    const header = String(dataUrl || '').slice(0, 30).toLowerCase();
    if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'JPEG';
    return 'PNG';
  };
  
  // Professional Header with proper spacing
  doc.setFillColor(250, 250, 250);
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  let headerY = 12;
  let contentX = 15;
  
  // Logo (left side)
  if (vetProfile?.logo_url) {
    try {
      const logoData = await loadImageForPdf(vetProfile.logo_url);
      if (logoData) {
        doc.addImage(logoData, getImageFormat(logoData), 15, headerY, 20, 20);
      }
      contentX = 40;
    } catch (e) {
      // Continue without logo
    }
  }
  
  // Vet name (main, bold)
  doc.setTextColor(34, 34, 34);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(vetProfile?.full_name || vetProfile?.fantasy_name || 'Veterinário', contentX, headerY);
  
  // Secondary info below name
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  
  let infoY = headerY + 6;
  if (vetProfile?.crmv) {
    doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, contentX, infoY);
    infoY += 3.5;
  }
  if (vetProfile?.city) {
    doc.text(`${vetProfile.city}${vetProfile.state ? ' - ' + vetProfile.state : ''}`, contentX, infoY);
    infoY += 3.5;
  }
  if (vetProfile?.phone) {
    doc.text(`Tel: ${vetProfile.phone}`, contentX, infoY);
    infoY += 3.5;
  }
  if (vetProfile?.email) {
    doc.text(`E-mail: ${vetProfile.email}`, contentX, infoY);
    infoY += 3.5;
  }
  
  // Document Title
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('PRESCRIÇÃO VETERINÁRIA', pageWidth - 15, 25, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`Documento Nº ${String(appointment?.id || '').slice(-8).toUpperCase() || 'SEM_ID'}`, pageWidth - 15, 30, { align: 'right' });
  
  // Separator
  let y = 55;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  y += 12;
  
  // Patient Identification - Two Column Layout
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('IDENTIFICAÇÃO DO PACIENTE', 15, y);
  y += 8;
  
  const colWidth = (pageWidth - 40) / 2;
  
  // Left Column - Client
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('PROPRIETÁRIO', 15, y);
  y += 4;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(client?.name || '-', 15, y);
  y += 4;
  if (client?.phone) {
    doc.setTextColor(100, 100, 100);
    doc.text(`Tel: ${client.phone}`, 15, y);
    y += 4;
  }
  
  // Right Column - Date & Animals
  let yRight = 75;
  doc.setFont(undefined, 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('DATA DA PRESCRIÇÃO', 15 + colWidth, yRight);
  yRight += 4;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(appointmentDateLabel, 15 + colWidth, yRight);
  
  y = Math.max(y, yRight) + 8;
  
  // Animals
  if (animals && animals.length > 0) {
    doc.setDrawColor(240, 240, 240);
    doc.setFillColor(252, 252, 255);
    const boxHeight = 4 + (animals.length * 4);
    doc.rect(15, y - 2, pageWidth - 30, boxHeight, 'FD');
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('ANIMAL(IS)', 18, y + 1);
    y += 5;
    
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    animals.forEach(animal => {
      const info = `${animal.name}${animal.species ? ' • ' + animal.species : ''}${animal.breed ? ' • ' + animal.breed : ''}`;
      doc.text(info, 18, y);
      y += 4;
    });
    y += 5;
  }
  
  // Diagnosis/Justification (if exists)
  if (appointment.diagnosis || appointment.symptoms) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('DIAGNÓSTICO / JUSTIFICATIVA', 15, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    const diagText = appointment.diagnosis || appointment.symptoms;
    const diagLines = doc.splitTextToSize(diagText, pageWidth - 30);
    doc.text(diagLines, 15, y);
    y += diagLines.length * 4.5 + 8;
  }
  
  // Prescription Table
  if (appointment.medications && appointment.medications.length > 0) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('MEDICAMENTOS PRESCRITOS', 15, y);
    y += 10;
    
    // Table Header
    doc.setFillColor(34, 197, 94);
    doc.rect(15, y - 6, pageWidth - 30, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('MEDICAMENTO', 17, y);
    doc.text('DOSE', 65, y);
    doc.text('VIA', 90, y);
    doc.text('FREQ.', 110, y);
    doc.text('DURAÇÃO', 130, y);
    doc.text('VALOR', 155, y); // NOVA COLUNA
    y += 6;
    doc.setTextColor(40, 40, 40);
    appointment.medications.forEach((med, index) => {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }
      // Row background
      if (index % 2 === 0) {
        doc.setFillColor(250, 252, 255);
        doc.rect(15, y - 4, pageWidth - 30, 14, 'F');
      }
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${med.name}`, 17, y);
      y += 4;
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'normal');
      if (med.active_ingredient) {
        doc.setTextColor(100, 100, 100);
        const ingLines = doc.splitTextToSize(med.active_ingredient, 60);
        doc.text(ingLines, 20, y);
        doc.setTextColor(40, 40, 40);
      }
      // Dosage
      if (med.dosage) {
        const doseLines = doc.splitTextToSize(med.dosage, 20);
        doc.text(doseLines, 65, y - 4);
      }
      // Route
      if (med.administration_route) {
        const routeLines = doc.splitTextToSize(med.administration_route, 15);
        doc.text(routeLines, 90, y - 4);
      }
      // Frequency
      if (med.frequency) {
        const freqLines = doc.splitTextToSize(med.frequency, 15);
        doc.text(freqLines, 110, y - 4);
      }
      // Duration
      if (med.duration) {
        const durLines = doc.splitTextToSize(med.duration, 15);
        doc.text(durLines, 130, y - 4);
      }
      // VALOR INDIVIDUAL
      const price = typeof med.price === 'number' ? med.price : (typeof med.value === 'number' ? med.value : parseFloat(med.price || med.value || 0));
      if (!isNaN(price)) {
        doc.setFont(undefined, 'bold');
        doc.text(`R$ ${price.toFixed(2)}`, 155, y - 4);
        doc.setFont(undefined, 'normal');
      }
      y += 3;
      // Instructions in separate row if exists
      if (med.instructions) {
        doc.setFont(undefined, 'italic');
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(7);
        const instrLines = doc.splitTextToSize(`→ ${med.instructions}`, pageWidth - 45);
        doc.text(instrLines, 20, y);
        y += instrLines.length * 3;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
      }
      y += 8;
    });
    y += 5;
  }
  
  // Clinical Guidance
  if (appointment.prescription_notes || appointment.observations) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('ORIENTAÇÕES E RECOMENDAÇÕES', 15, y);
    y += 7;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    const notes = appointment.prescription_notes || appointment.observations;
    const notesLines = doc.splitTextToSize(notes, pageWidth - 30);
    doc.text(notesLines, 15, y);
    y += notesLines.length * 4.5 + 10;
  }
  
  // Signature Section
  if (y > pageHeight - 55) {
    doc.addPage();
    y = 20;
  } else {
    y = Math.max(y, pageHeight - 55);
  }
  
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, pageWidth - 15, y);
  y += 10;
  
  // Digital signature if exists
  const vetSignatureSource = vetProfile?.signature_url || vetProfile?.signature;
  if (vetSignatureSource) {
    try {
      const sigData = await loadImageForPdf(vetSignatureSource);
      if (sigData) {
        doc.addImage(sigData, getImageFormat(sigData), 15, y, 40, 15);
      } else {
        doc.setDrawColor(180, 180, 180);
        doc.line(15, y + 10, 70, y + 10);
      }
      y += 18;
    } catch (e) {
      // Line for manual signature
      doc.setDrawColor(180, 180, 180);
      doc.line(15, y + 10, 70, y + 10);
      y += 13;
    }
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.line(15, y + 10, 70, y + 10);
    y += 13;
  }
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(vetProfile?.full_name || 'Médico Veterinário', 15, y);
  y += 4;
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  if (vetProfile?.crmv) {
    doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, 15, y);
  }
  
  // Add location if available
  if (vetProfile?.city && vetProfile?.state) {
    y += 4;
    doc.text(`${vetProfile.city} - ${vetProfile.state}, ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, 15, y);
  }
  
  // Footer - Legal Notice
  const footerY = pageHeight - 18;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont(undefined, 'italic');
  const disclaimer = 'Prescrição válida por 30 dias. Uso exclusivo veterinário. Não utilize medicamentos sem orientação profissional.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - 30);
  doc.text(disclaimerLines, 15, footerY - 8);
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} via DuoVet`, 15, footerY);
  
  const output = options?.output || 'save';
  if (output === 'blob') {
    return doc.output('blob');
  }
  if (output === 'bloburl') {
    return doc.output('bloburl');
  }
  doc.save(`prescricao_${appointmentShortCode}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  return null;
};
