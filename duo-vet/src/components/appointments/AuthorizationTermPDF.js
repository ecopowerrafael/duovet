import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { offlineFetch } from '../../lib/offline';

export const generateAuthorizationTermPDF = async (appointment, client, property, animals, lot, userProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

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
    const header = String(dataUrl || '').slice(0, 40).toLowerCase();
    if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'JPEG';
    return 'PNG';
  };

  // Header background
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, pageWidth, 45, 'F');

  let headerY = 15;
  let contentX = margin;

  // Logo (left side)
  if (userProfile?.logo_url) {
    try {
      const logoData = await loadImageForPdf(userProfile.logo_url);
      if (logoData) {
        doc.addImage(logoData, getImageFormat(logoData), margin, 10, 25, 25);
        contentX = margin + 30;
      }
    } catch (e) {
      // Continue without logo
    }
  }

  // Professional Info
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(userProfile?.full_name || userProfile?.fantasy_name || 'Médico Veterinário', contentX, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (userProfile?.crmv) {
    doc.text(`CRMV: ${userProfile.crmv}${userProfile.crmv_state ? ' - ' + userProfile.crmv_state : ''}`, contentX, 27);
  }
  if (userProfile?.phone) {
    doc.text(`Tel: ${userProfile.phone}`, contentX, 32);
  }
  if (userProfile?.email) {
    doc.text(`E-mail: ${userProfile.email}`, contentX, 37);
  }
  if (userProfile?.city || userProfile?.state) {
    const location = `${userProfile?.city || ''}${userProfile?.city && userProfile?.state ? ' - ' : ''}${userProfile?.state || ''}`.trim();
    if (location) {
      doc.text(location, contentX, 42);
    }
  }

  // Document Title - Right aligned
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('TERMO DE AUTORIZAÇÃO', pageWidth - margin, 25, { align: 'right' });

  // Separator
  let y = 55;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Client Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('DADOS DO CLIENTE / PROPRIETÁRIO', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(`Nome: ${client?.name || '___________________________'}`, margin, y);
  y += 6;
  doc.text(`CPF/CNPJ: ${client?.document || '___________________________'}`, margin, y);
  y += 6;
  doc.text(`Propriedade: ${property?.name || '___________________________'}`, margin, y);
  y += 6;
  doc.text(`Endereço: ${property?.address || '___________________________'}`, margin, y);
  y += 12;

  // Animal Info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('DADOS DO(S) ANIMAL(IS) / LOTE', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  
  if (lot) {
    doc.text(`Lote: ${lot.name}`, margin, y);
    y += 6;
    doc.text(`Espécie: ${lot.species}`, margin, y);
    y += 6;
    doc.text(`Quantidade: ${lot.quantity} cabeças`, margin, y);
    y += 6;
  } else if (animals && animals.length > 0) {
    const animalNames = animals.map(a => a.name).join(', ');
    const nameLines = doc.splitTextToSize(`Animal(is): ${animalNames}`, pageWidth - (margin * 2));
    doc.text(nameLines, margin, y);
    y += (nameLines.length * 6);
    doc.text(`Espécie: ${animals[0].species}`, margin, y);
    y += 6;
  } else {
    doc.text('Animal/Lote: ___________________________', margin, y);
    y += 6;
  }
  y += 10;

  // Authorization Text
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('TERMO DE CONSENTIMENTO', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  
  const text = `Eu, acima identificado, na qualidade de proprietário ou responsável pelo(s) animal(is) acima descrito(s), autorizo o Médico Veterinário a realizar os procedimentos necessários para o atendimento solicitado, incluindo exames, medicações, procedimentos cirúrgicos, reprodutivos ou clínicos, conforme a necessidade diagnosticada.

Estou ciente de que a medicina não é uma ciência exata e que existem riscos inerentes a qualquer procedimento veterinário. Fui informado(a) sobre a natureza dos procedimentos, riscos e possíveis complicações.

Comprometo-me a seguir as orientações pós-atendimento e a efetuar o pagamento dos honorários e despesas decorrentes deste atendimento.

Autorizo também a coleta de material biológico para fins de diagnóstico, se necessário.`;

  const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
  doc.text(splitText, margin, y);
  y += (splitText.length * 5.5) + 15;

  // Diagnosis/Procedures (if available)
  if (appointment?.diagnosis || appointment?.procedures?.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('OBSERVAÇÕES DO ATENDIMENTO:', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    if (appointment.diagnosis) {
      const diagLines = doc.splitTextToSize(`Diagnóstico/Suspeita: ${appointment.diagnosis}`, pageWidth - (margin * 2));
      doc.text(diagLines, margin, y);
      y += (diagLines.length * 6);
    }
    if (appointment.procedures?.length > 0) {
      const procList = appointment.procedures.map(p => p.name).join(', ');
      const procLines = doc.splitTextToSize(`Procedimentos previstos: ${procList}`, pageWidth - (margin * 2));
      doc.text(procLines, margin, y);
      y += (procLines.length * 6);
    }
    y += 10;
  }

  // Date and Signatures
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  } else {
    y = pageHeight - 60;
  }

  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${property?.city || 'Local'}: ${today}`, margin, y);
  y += 25;

  // Signature lines
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, margin + 75, y);
  doc.text('Assinatura do Responsável', margin, y + 5);

  const vetSignatureSource = userProfile?.signature_url || userProfile?.signature;
  if (vetSignatureSource) {
    try {
      const sigData = await loadImageForPdf(vetSignatureSource);
      if (sigData) {
        doc.addImage(sigData, getImageFormat(sigData), pageWidth - margin - 70, y - 16, 48, 14);
      }
    } catch (e) {}
  }
  doc.line(pageWidth - margin - 75, y, pageWidth - margin, y);
  doc.text('Assinatura do Veterinário', pageWidth - margin - 75, y + 5);
  if (userProfile?.full_name || userProfile?.fantasy_name) {
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(userProfile?.full_name || userProfile?.fantasy_name, pageWidth - margin - 75, y + 10);
    if (userProfile?.crmv) {
      doc.text(`CRMV ${userProfile.crmv}${userProfile?.crmv_state ? ` - ${userProfile.crmv_state}` : ''}`, pageWidth - margin - 75, y + 14);
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Gerado por DuoVet - Gestão Veterinária', pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.save(`Termo_Autorizacao_${client?.name || 'Cliente'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
