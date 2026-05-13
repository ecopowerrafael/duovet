const express = require('express');
const { authMiddleware } = require('./auth');
const db = require('./db');
const router = express.Router();

// Listar todas as faturas
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { created_by } = req.query;
    let query = 'SELECT * FROM invoices';
    const params = [];
    
    // Se não for admin, filtra pelo criador (case-insensitive)
    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(req.user.email);
    } else if (created_by && created_by !== 'undefined') {
      // Se for admin mas passou um filtro específico
      query += ' WHERE LOWER(created_by) = LOWER($1)';
      params.push(created_by);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Obter fatura por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM invoices WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

const { emitNFSe } = require('./lib/fiscal');

// Criar nova fatura
router.post('/', authMiddleware, async (req, res, next) => {
  const { client_id, amount, status, due_date, description, items, payment_id } = req.body;
  const created_by = req.user.email;
  
  try {
    let finalClientId = client_id;
    let finalAmount = amount;
    let finalDueDate = due_date;
    let finalDescription = description;

    // Se payment_id fornecido, busca dados do pagamento
    if (payment_id) {
       const paymentRes = await db.query('SELECT * FROM payments WHERE id = $1', [payment_id]);
       if (paymentRes.rows.length > 0) {
          const payment = paymentRes.rows[0];
          if (!finalClientId) finalClientId = payment.client_id;
          if (!finalAmount) finalAmount = payment.amount;
          if (!finalDueDate) finalDueDate = payment.date;
          if (!finalDescription) finalDescription = `Fatura referente ao pagamento #${payment.id}`;
       }
    }

    // Insere a fatura
    const result = await db.query(
      'INSERT INTO invoices (client_id, amount, status, due_date, description, items, created_by, created_at, payment_id) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING *',
      [finalClientId, finalAmount, status || 'pendente', finalDueDate, finalDescription, JSON.stringify(items || []), created_by, payment_id]
    );
    
    const invoice = result.rows[0];

    // Tenta emitir NFSe se configurado
    try {
      const userId = req.user.id;
      
      // Busca configurações fiscais do usuário
      const settingsRes = await db.query(
        "SELECT key, value FROM settings WHERE user_id = $1 AND key IN ('fiscal_api_key', 'cnpj', 'inscricao_municipal', 'codigo_municipio', 'aliquota', 'service_code', 'nf_enabled')", 
        [userId]
      );
      
      const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      
      if (settings.nf_enabled === 'true' && settings.fiscal_api_key) {
         console.log('Iniciando emissão de NFSe para fatura #', invoice.id);
         
         // Busca dados do client para a NF
         const clientRes = await db.query('SELECT * FROM clients WHERE id = $1', [finalClientId]);
         const clientData = clientRes.rows[0];
         
         if (clientData) {
            const invoiceData = {
              client_document: clientData.cpf_cnpj || '00000000000', // Fallback se não tiver
              client_name: clientData.name,
              client_email: clientData.email,
              client_address_street: clientData.address, // Simplificado, idealmente separar campos
              client_address_number: 'S/N',
              client_address_neighborhood: 'Centro',
              client_city_code: '3550308', // SP Capital (exemplo)
              client_state: 'SP',
              client_zip: '01001000',
              amount: finalAmount,
              description: finalDescription
            };
            
            // Chama API Fiscal (FocusNFe)
            // Se falhar, captura erro mas não falha a criação da fatura
            try {
              const nfResponse = await emitNFSe(invoiceData, settings.fiscal_api_key, settings);
              
              // Atualiza status se sucesso
              await db.query("UPDATE invoices SET status = 'emitida', notes = $1 WHERE id = $2", 
                [JSON.stringify(nfResponse), invoice.id]
              );
              invoice.status = 'emitida';
              invoice.nf_data = nfResponse;
            } catch (fiscalError) {
              console.error('Erro na emissão fiscal:', fiscalError.message);
              // Opcional: Atualizar status para 'erro_emissao'
              await db.query("UPDATE invoices SET status = 'erro_emissao' WHERE id = $1", [invoice.id]);
              invoice.status = 'erro_emissao';
            }
         }
      }
    } catch (e) {
      console.error('Erro geral no processo fiscal:', e);
    }

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// Atualizar fatura
router.put('/:id', authMiddleware, async (req, res, next) => {
  const { status, amount, due_date, description, items } = req.body;
  try {
    let query = 'UPDATE invoices SET status = $1, amount = $2, due_date = $3, description = $4, items = $5 WHERE id = $6';
    const params = [status, amount, due_date, description, JSON.stringify(items || []), parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($7)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Deletar fatura
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    let query = 'DELETE FROM invoices WHERE id = $1';
    const params = [parseInt(req.params.id)];

    if (req.user && req.user.email !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(req.user.email);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json({ message: 'Fatura deletada com sucesso' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
