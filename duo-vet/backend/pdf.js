// Função customizada: geração de PDF de agendamento (mock)
const express = require('express');
const router = express.Router();


const PDFDocument = require('pdfkit');
const { Readable } = require('stream');


const { authMiddleware } = require('./auth');


router.post('/generate-appointment', authMiddleware, (req, res) => {
  const { appointmentId, data } = req.body;
  const doc = new PDFDocument();
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=agendamento_${appointmentId || 'pdf'}.pdf`,
      'Content-Length': pdfData.length
    });
    res.send(pdfData);
  });

  // Conteúdo do PDF (exemplo simples)
  doc.fontSize(18).text('Agendamento', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`ID: ${appointmentId || 'N/A'}`);
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`);
    });
  }
  doc.end();
});

module.exports = router;
