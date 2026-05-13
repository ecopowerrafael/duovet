import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export function formatCurrency(value) {
  const amount = typeof value === 'string' ? parseFloat(value.replace(/[^\d]/g, '')) / 100 : value;
  if (isNaN(amount)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function parseCurrency(formattedValue) {
  if (!formattedValue) return 0;
  const numericValue = formattedValue.replace(/[^\d]/g, '');
  return parseFloat(numericValue) / 100;
}

export function digitsOnly(value = '') {
  return String(value).replace(/\D/g, '');
}

export function formatNumberDigits(value = '') {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('pt-BR');
}

export function formatCpf(value = '') {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCnpj(value = '') {
  const digits = digitsOnly(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatCpfCnpj(value = '') {
  const digits = digitsOnly(value);
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
}

export function formatPhoneBr(value = '') {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Normaliza um ID para string, lidando com objetos do MongoDB, números e strings com espaços.
 */
export function normalizeId(id) {
  if (id === null || id === undefined) return '';
  
  // Se for um objeto (como um documento populado ou um ObjectId do MongoDB)
  if (typeof id === 'object') {
    if (id.id) return String(id.id).trim();
    if (id._id) return String(id._id).trim();
    if (id.$oid) return String(id.$oid).trim();
    // Se for um objeto mas não tem id/_id conhecido, tenta converter pra string
    // mas evita [object Object]
    const str = String(id);
    if (str === '[object Object]') return '';
    return str.trim();
  }
  
  return String(id).trim();
}

/**
 * Compara dois IDs de forma robusta.
 */
export function compareIds(id1, id2) {
  const norm1 = normalizeId(id1);
  const norm2 = normalizeId(id2);
  return norm1 !== '' && norm2 !== '' && norm1 === norm2;
}

/**
 * Remove recursivamente strings vazias, nulos e undefined de um objeto ou array.
 * Útil para limpar payloads antes de enviar ao servidor e evitar erros de tipo (ex: integer "").
 */
export function deepClean(obj) {
  if (Array.isArray(obj)) {
    // Filtra nulos, undefined e também strings vazias dentro de arrays
    const cleanedArray = obj
      .map(deepClean)
      .filter(item => item !== null && item !== undefined && item !== '');
    return cleanedArray.length > 0 ? cleanedArray : null;
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned = {};
    Object.entries(obj).forEach(([key, value]) => {
      const cleanedValue = deepClean(value);
      // Mantém valores booleanos (false), números (0) e strings não vazias.
      // Remove '', null e undefined.
      if (cleanedValue !== '' && cleanedValue !== null && cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj;
}
