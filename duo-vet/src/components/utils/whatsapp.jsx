/**
 * Formata número de telefone para uso no WhatsApp
 * Remove caracteres especiais e adiciona código do país se necessário
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  
  // Remove todos os caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Se não começar com código do país, adiciona 55 (Brasil)
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Gera link do WhatsApp Web/App
 * @param {string} phone - Número do telefone
 * @param {string} message - Mensagem pré-preenchida (opcional)
 */
export function getWhatsAppLink(phone, message = '') {
  const formattedNumber = formatWhatsAppNumber(phone);
  if (!formattedNumber) return null;
  
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${formattedNumber}${encodedMessage}`;
}

/**
 * Abre o WhatsApp de forma resiliente em web/mobile.
 * Em mobile/PWA, usa redirecionamento direto para evitar bloqueio de popup.
 */
export function openWhatsApp(phone, message = '') {
  const link = getWhatsAppLink(phone, message);
  if (!link) return false;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (isMobile) {
    window.location.assign(link);
    return true;
  }

  const popup = window.open(link, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(link);
  }
  return true;
}

/**
 * Valida se o número de telefone está no formato correto
 */
export function isValidWhatsAppNumber(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  // Validação básica: deve ter pelo menos 10 dígitos (DDD + número)
  return cleaned.length >= 10 && cleaned.length <= 15;
}