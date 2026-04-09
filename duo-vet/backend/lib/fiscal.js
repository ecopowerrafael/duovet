// Integração com FocusNFe (exemplo)
// Documentação: https://focusnfe.com.br/doc

const fetch = global.fetch || require('node-fetch');

// URL base da API (Produção ou Homologação)
const API_URL = process.env.FISCAL_ENV === 'production' 
  ? 'https://api.focusnfe.com.br/v2' 
  : 'https://homologacao.focusnfe.com.br/v2';

/**
 * Emite uma Nota Fiscal de Serviço (NFSe)
 * @param {object} invoiceData - Dados da fatura
 * @param {string} apiKey - Chave de API do usuário
 * @param {object} providerSettings - Configurações fiscais do prestador
 */
async function emitNFSe(invoiceData, apiKey, providerSettings) {
  if (!apiKey) {
    throw new Error('Chave fiscal não configurada');
  }

  // Mapeia os dados para o formato da FocusNFe
  const payload = {
    data_emissao: new Date().toISOString(),
    prestador: {
      cnpj: providerSettings.cnpj,
      inscricao_municipal: providerSettings.im,
      codigo_municipio: providerSettings.cod_municipio,
    },
    tomador: {
      cnpj_cpf: invoiceData.client_document, // CPF/CNPJ do cliente
      razao_social: invoiceData.client_name,
      email: invoiceData.client_email,
      endereco: {
        logradouro: invoiceData.client_address_street,
        numero: invoiceData.client_address_number,
        bairro: invoiceData.client_address_neighborhood,
        codigo_municipio: invoiceData.client_city_code,
        uf: invoiceData.client_state,
        cep: invoiceData.client_zip,
      }
    },
    servico: {
      aliquota: providerSettings.aliquota || 2.0,
      discriminacao: invoiceData.description,
      iss_retido: false,
      item_lista_servico: providerSettings.service_code || '10.01',
      codigo_tributario_municipio: providerSettings.service_code_municipal,
      valor_servicos: invoiceData.amount,
    }
  };

  console.log('Enviando NFSe para FocusNFe:', JSON.stringify(payload, null, 2));

  // Autenticação Basic Auth (user=apiKey, pass="")
  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  try {
    const response = await fetch(`${API_URL}/nfse`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro FocusNFe:', data);
      throw new Error(data.mensagem || 'Erro ao emitir NFSe');
    }

    return {
      status: 'processando', // FocusNFe retorna 'processando' inicialmente
      ref: data.ref,
      url: data.caminho_xml_nota_fiscal // Exemplo
    };
  } catch (error) {
    console.error('Falha na requisição fiscal:', error);
    // Em caso de erro de rede, podemos lançar ou retornar erro
    throw error;
  }
}

/**
 * Consulta o status de uma NFSe
 */
async function consultNFSe(ref, apiKey) {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const response = await fetch(`${API_URL}/nfse/${ref}`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  return await response.json();
}

module.exports = { emitNFSe, consultNFSe };
