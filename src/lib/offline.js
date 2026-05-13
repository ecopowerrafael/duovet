// Gerenciador offline: cache de GET e fila de mutações (POST/PUT/DELETE)
import React, { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { Native } from './native';
import { deepClean } from './utils';

const CACHE_PREFIX = 'offline:cache:';
const QUEUE_KEY = 'offline:mutation_queue';
const TOKEN_KEY = 'offline:token';
const MAX_QUEUE_SIZE = 50;
const PHOTO_TARGET_BYTES = 48 * 1024;
const PHOTO_INITIAL_QUALITY = 0.76;
const PHOTO_MIN_QUALITY = 0.35;
const PHOTO_MAX_DIMENSION = 960;
const APPOINTMENT_BODY_TARGET_BYTES = 85 * 1024;
const APPOINTMENT_BODY_MIN_PHOTO_BYTES = 12 * 1024;
export const SYNC_ERROR_EVENT = 'offline:sync-error';

// Configuração de API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://duovet.app';

export function getApiBaseUrl() {
  return String(API_BASE_URL).replace(/\/$/, '');
}

function resolveApiUrl(path) {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (base.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${base}${cleanPath.slice(4)}`;
  }
  return `${base}${cleanPath}`;
}

export function getGoogleAuthUrl() {
  return resolveApiUrl('/api/auth/google');
}

export function getGoogleCalendarAuthUrl() {
  return resolveApiUrl('/api/auth/google/calendar');
}

function getFullUrl(path) {
  if (path.startsWith('http')) return path;
  return resolveApiUrl(path);
}

function isRetryableStatus(status) {
  if (typeof status !== 'number') return true;
  if (status === 408 || status === 429) return true;
  if (status === 502 || status === 503 || status === 504) return true;
  return false;
}

function createSyncError({ status, detail = '', url = '', method = '' }) {
  const safeDetail = typeof detail === 'string' ? detail.trim() : '';
  const detailText = safeDetail ? `: ${safeDetail}` : '';
  const error = new Error(`Falha ao sincronizar (${status})${detailText}`);
  error.name = 'SyncError';
  error.status = status;
  error.detail = safeDetail;
  error.url = url;
  error.method = method;
  error.isRetryable = isRetryableStatus(status);
  return error;
}

function extractStatusFromError(error) {
  if (!error) return undefined;
  if (typeof error.status === 'number') return error.status;
  const message = String(error.message || '');
  const match = message.match(/\((\d{3})\)/);
  if (!match) return undefined;
  return Number(match[1]);
}

function normalizeSyncError(error, item = {}) {
  if (!error) return new Error('Falha desconhecida durante sincronização');
  if (typeof error.status === 'number') {
    if (typeof error.isRetryable !== 'boolean') {
      error.isRetryable = isRetryableStatus(error.status);
    }
    if (!error.url && item?.url) error.url = item.url;
    if (!error.method && item?.method) error.method = item.method;
    return error;
  }
  const status = extractStatusFromError(error);
  if (typeof status === 'number') {
    return createSyncError({
      status,
      detail: error.detail || String(error.message || ''),
      url: item?.url || '',
      method: item?.method || ''
    });
  }
  error.isRetryable = true;
  return error;
}

function notifySupportSyncError(error) {
  const status = extractStatusFromError(error);
  const payload = {
    code: status || 'UNKNOWN',
    message: String(error?.message || 'Falha desconhecida durante sincronização'),
    path: error?.url || '',
    method: error?.method || '',
    at: new Date().toISOString()
  };
  console.error('[offline] support-notified', payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: payload }));
  }
}

export function formatSyncErrorForUser(error) {
  const syncError = normalizeSyncError(error);
  const status = extractStatusFromError(syncError);
  if (!status) {
    return 'Não foi possível sincronizar agora. Verifique sua conexão e tente novamente.';
  }
  return `Erro ${status} ao sincronizar. Nossa equipe de suporte já foi avisada automaticamente.`;
}

function estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const parts = dataUrl.split(',');
  if (parts.length < 2) return 0;
  return Math.ceil((parts[1].length * 3) / 4);
}

function estimateJsonBytes(value) {
  try {
    const encoded = JSON.stringify(value ?? {});
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(encoded).length;
    }
    return encoded.length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function canResizeImageInRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressDataImageUrl(dataUrl, targetBytes = PHOTO_TARGET_BYTES) {
  if (!canResizeImageInRuntime()) return dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
  if (estimateDataUrlBytes(dataUrl) <= targetBytes) return dataUrl;

  try {
    const image = await loadImageElement(dataUrl);
    let width = image.width;
    let height = image.height;
    const maxSide = Math.max(width, height);
    if (maxSide > PHOTO_MAX_DIMENSION) {
      const scale = PHOTO_MAX_DIMENSION / maxSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    let bestResult = dataUrl;
    let bestSize = estimateDataUrlBytes(bestResult);

    for (let dimensionPass = 0; dimensionPass < 4; dimensionPass++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(image, 0, 0, width, height);

      for (let quality = PHOTO_INITIAL_QUALITY; quality >= PHOTO_MIN_QUALITY; quality -= 0.1) {
        const candidate = canvas.toDataURL('image/jpeg', quality);
        const candidateSize = estimateDataUrlBytes(candidate);
        if (candidateSize < bestSize) {
          bestResult = candidate;
          bestSize = candidateSize;
        }
        if (candidateSize <= targetBytes) {
          return candidate;
        }
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    return bestResult;
  } catch {
    return dataUrl;
  }
}

async function optimizeAppointmentPhotosBody(body) {
  if (!body || typeof body !== 'object') return body;
  if (!Array.isArray(body.photos) || body.photos.length === 0) return body;

  let changed = false;
  const optimizedPhotos = [];
  for (const item of body.photos) {
    if (!item || typeof item !== 'object') {
      optimizedPhotos.push(item);
      continue;
    }
    const resolvedUrl = item.url || item.file_url || item.photo_url || '';
    let nextUrl = resolvedUrl;
    if (typeof resolvedUrl === 'string' && resolvedUrl.startsWith('data:image/')) {
      nextUrl = await compressDataImageUrl(resolvedUrl);
    }
    const normalized = {
      ...item,
      url: nextUrl
    };
    if (nextUrl !== resolvedUrl || item.file_url || item.photo_url) {
      changed = true;
    }
    delete normalized.file_url;
    delete normalized.photo_url;
    optimizedPhotos.push(normalized);
  }

  let nextBody = changed ? {
    ...body,
    photos: optimizedPhotos
  } : body;

  let estimatedBodySize = estimateJsonBytes(nextBody);
  if (estimatedBodySize <= APPOINTMENT_BODY_TARGET_BYTES) return nextBody;

  let targetBytes = Math.max(APPOINTMENT_BODY_MIN_PHOTO_BYTES, Math.floor(PHOTO_TARGET_BYTES * 0.75));
  for (let pass = 0; pass < 5 && estimatedBodySize > APPOINTMENT_BODY_TARGET_BYTES; pass++) {
    let passChanged = false;
    const resizedPhotos = [];
    for (const item of nextBody.photos) {
      if (!item || typeof item !== 'object') {
        resizedPhotos.push(item);
        continue;
      }
      const currentUrl = item.url || '';
      if (typeof currentUrl === 'string' && currentUrl.startsWith('data:image/')) {
        const smallerUrl = await compressDataImageUrl(currentUrl, targetBytes);
        if (smallerUrl !== currentUrl) {
          passChanged = true;
        }
        resizedPhotos.push({ ...item, url: smallerUrl });
      } else {
        resizedPhotos.push(item);
      }
    }
    if (!passChanged) break;
    nextBody = {
      ...nextBody,
      photos: resizedPhotos
    };
    estimatedBodySize = estimateJsonBytes(nextBody);
    targetBytes = Math.max(APPOINTMENT_BODY_MIN_PHOTO_BYTES, Math.floor(targetBytes * 0.75));
  }

  return nextBody;
}

// Estado local síncrono para acesso rápido
let currentQueue = [];
let networkStatus = { connected: true };
let currentToken = '';
let flushing = false;

// Event emitter simples para mudanças de estado
const listeners = new Set();
function notifyListeners() {
  listeners.forEach(l => l());
}

// Hook para status em tempo real
export function useOfflineStatus() {
  const [status, setStatus] = useState({
    isOnline: isOnline(),
    pendingCount: currentQueue.length,
    isSyncing: flushing
  });

  useEffect(() => {
    const update = () => {
      setStatus({
        isOnline: isOnline(),
        pendingCount: currentQueue.length,
        isSyncing: flushing
      });
    };

    listeners.add(update);
    // Fallback interval
    const interval = setInterval(update, 5000);
    
    return () => {
      listeners.delete(update);
      clearInterval(interval);
    };
  }, []);

  return status;
}

// Inicialização
export async function initOffline() {
  if (typeof window === 'undefined') return;
  
  // Carregar token inicial
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) {
      currentToken = value;
    } else {
      currentToken = localStorage.getItem('token') || '';
      if (currentToken) {
        await Preferences.set({ key: TOKEN_KEY, value: currentToken });
      }
    }
  } catch (e) {
    console.error('[offline] Erro ao carregar token inicial:', e);
    currentToken = localStorage.getItem('token') || '';
  }

  Network.getStatus().then(status => {
    networkStatus = status;
    notifyListeners();
  });

  Network.addListener('networkStatusChange', status => {
    networkStatus = status;
    notifyListeners();
    if (status.connected) {
      flushQueueInternal();
    }
  });

  // Carregar fila inicial
  Preferences.get({ key: QUEUE_KEY }).then(({ value }) => {
    if (value) {
      try {
        currentQueue = JSON.parse(value);
        notifyListeners();
      } catch (e) {
        currentQueue = [];
      }
    }
  });
}

export function isOnline() {
  const connected = networkStatus.connected && (typeof navigator !== 'undefined' ? navigator.onLine : true);
  // console.log(`[offline] isOnline check: ${connected} (networkStatus: ${networkStatus.connected}, navigator: ${typeof navigator !== 'undefined' ? navigator.onLine : 'N/A'})`);
  return connected;
}

/**
 * Fetch direto que respeita o BASE_URL, usado para login/register
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(getFullUrl(url), options);
  if (res.status === 401) {
    await handleUnauthorized();
  }
  return res;
}

export async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(getFullUrl(url), {
    ...options,
    headers
  });
  if (res.status === 401) {
    await handleUnauthorized();
  }
  return res;
}

export function getAuthToken() {
  return currentToken;
}

export async function getAuthTokenAsync() {
  if (currentToken) return currentToken;
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) {
      currentToken = value;
    } else {
      currentToken = localStorage.getItem('token') || '';
    }
  } catch (e) {
    currentToken = localStorage.getItem('token') || '';
  }
  return currentToken;
}

export async function setAuthToken(token) {
  currentToken = token;
  localStorage.setItem('token', token); // Mantém no localStorage para compatibilidade PWA
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function removeAuthToken() {
  currentToken = '';
  localStorage.removeItem('token');
  await Preferences.remove({ key: TOKEN_KEY });
}

function normalizeKey(url) {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.sort?.();
    return `${CACHE_PREFIX}${u.pathname}${u.search}`;
  } catch {
    return `${CACHE_PREFIX}${url}`;
  }
}

async function readCache(key) {
  try {
    const { value } = await Preferences.get({ key });
    if (!value) return null;
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function writeCache(key, value) {
  try {
    await Preferences.set({
      key,
      value: JSON.stringify({
        data: value,
        updatedAt: Date.now(),
      })
    });
  } catch {
    // ignorar
  }
}

function loadQueue() {
  return currentQueue;
}

async function saveQueue(queue) {
  currentQueue = queue;
  notifyListeners();
  try {
    await Preferences.set({
      key: QUEUE_KEY,
      value: JSON.stringify(queue)
    });
  } catch {
    // ignorar
  }
}

async function enqueueRequest(item) {
  const queue = [...currentQueue];
  const shouldMergeAppointmentUpdate =
    item?.method === 'PUT' &&
    typeof item?.url === 'string' &&
    item.url.startsWith('/api/appointments/');
  let mergedItem = item;
  const normalizedQueue = shouldMergeAppointmentUpdate
    ? queue.filter((queued) => {
      const isSameAppointmentUpdate = queued?.method === 'PUT' && queued?.url === item.url;
      if (isSameAppointmentUpdate) {
        const previousBody = queued?.body && typeof queued.body === 'object' ? queued.body : {};
        const nextBody = item?.body && typeof item.body === 'object' ? item.body : {};
        mergedItem = {
          ...item,
          body: {
            ...previousBody,
            ...nextBody
          }
        };
      }
      return !isSameAppointmentUpdate;
    })
    : queue;
  if (normalizedQueue.length >= MAX_QUEUE_SIZE) {
    normalizedQueue.shift();
  }
  normalizedQueue.push(mergedItem);
  await saveQueue(normalizedQueue);
}

export const AUTH_EXPIRED_EVENT = 'offline:auth-expired';

async function handleUnauthorized() {
  console.error('[offline] Sessão expirada (401). Limpando token...');
  await removeAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

export async function offlineFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const responseType = options.responseType || 'json';
  
  if (method !== 'GET') {
    throw new Error('offlineFetch é apenas para GET. Use enqueueMutation para mutações.');
  }
  const key = normalizeKey(url);
  
  if (isOnline()) {
    const token = getAuthToken();
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // Log para depuração (remover em produção)
    // console.log(`[offline] Fetching ${url} | Token length: ${token ? token.length : 0}`);

    try {
      const res = await fetch(getFullUrl(url), { 
        ...options, 
        headers,
        cache: 'no-store'
      });

      if (res.status === 401) {
        console.warn(`[offline] 401 Unauthorized para ${url}. Token presente: ${!!token}. Tentando logout...`);
        await handleUnauthorized();
        throw new Error('Sua sessão expirou. Por favor, faça login novamente. [401]');
      }

      if (res.status === 403) {
        let detail = '';
        try {
          detail = (await res.text()).slice(0, 200);
        } catch {
          detail = '';
        }
        const suffix = detail ? `: ${detail}` : '';
        throw new Error(`Acesso bloqueado. Assine para continuar. [403]${suffix}`);
      }

      if (res.ok) {
        let data;
        if (responseType === 'json') {
          data = await res.json();
        } else if (responseType === 'blob') {
          const blob = await res.blob();
          data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
        await writeCache(key, data);
        return data;
      }
    } catch (e) {
      if (e.message && (e.message.includes('[401]') || e.message.includes('[403]'))) {
        throw e;
      }
      console.warn('[offline] Fetch failed, falling back to cache', e);
    }
  }

  const cached = await readCache(key);
  if (cached?.data !== undefined) {
    return cached.data;
  }
  throw new Error('Sem conexão e sem cache disponível [OFFLINE_NO_CACHE]');
}

async function performRequest(item) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': item.contentType || 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(item.headers || {}),
  };

  // Limpeza de segurança do body antes de enviar (evita erros de tipo no servidor)
  let body = item.body;
  if (body != null && typeof body === 'object') {
    body = deepClean(body);
  }
  if (item.method === 'PUT' && String(item.url || '').startsWith('/api/appointments/')) {
    body = await optimizeAppointmentPhotosBody(body);
  }

  // Log payload being synced to help debug 500 errors
  if (item.method !== 'GET') {
    console.log(`[offline] Syncing ${item.method} ${item.url}:`, body);
  }

  const init = {
    method: item.method,
    headers,
    body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  };

  // console.log(`[offline] Flushing request ${item.url} | Token length: ${token ? token.length : 0}`);

  let res;
  try {
    res = await fetch(getFullUrl(item.url), init);
  } catch (fetchError) {
    console.error(`[offline] Network error during fetch for ${item.url}:`, fetchError);
    throw fetchError;
  }
  
  if (res.status === 401) {
    console.warn(`[offline] 401 Unauthorized durante sincronização para ${item.url}. Token presente: ${!!token}.`);
    await handleUnauthorized();
    throw new Error('Sua sessão expirou durante a sincronização. [401]');
  }

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errorText = await res.text();
      errorDetail = errorText.slice(0, 200); // Pegar os primeiros 200 caracteres do erro
      console.error(`[offline] Erro do servidor (${res.status}) para ${item.url}:`, errorDetail);
    } catch (e) {
      console.error(`[offline] Falha ao ler corpo do erro (${res.status}) para ${item.url}`);
    }
    throw createSyncError({
      status: res.status,
      detail: errorDetail,
      url: item.url,
      method: item.method
    });
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function flushQueueInternal(options = {}) {
  const { throwOnError = false, force = false } = options;
  console.log('[offline] flushQueueInternal called', { throwOnError, force, flushing, isOnline: isOnline(), queueLength: currentQueue.length });
  
  if (flushing) {
    console.warn('[offline] Sync already in progress (flushing=true).');
    return;
  }
  if (!isOnline()) {
    console.warn('[offline] Cannot sync: device is offline.');
    if (throwOnError) throw new Error('Dispositivo offline. Verifique sua conexão.');
    return;
  }
  
  const queueLength = currentQueue.length;
  if (queueLength === 0) {
    console.log('[offline] Queue is empty, nothing to sync.');
    return;
  }

  console.log(`[offline] Starting sync for ${queueLength} items...`);
  flushing = true;
  notifyListeners();
  let errorToThrow = null;
  try {
    let queue = [...currentQueue];
    let changed = false;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (!isOnline()) {
        console.warn('[offline] Device went offline during sync.');
        break;
      }
      const now = Date.now();
      if (!force && item.nextAttemptAt && now < item.nextAttemptAt) {
        console.log(`[offline] Skipping item ${item.id}, next attempt in ${Math.round((item.nextAttemptAt - now)/1000)}s`);
        continue;
      }
      
      try {
        console.log(`[offline] Syncing ${item.method} ${item.url} (ID: ${item.id})...`);
        await performRequest(item);
        console.log(`[offline] Sync successful for item ${item.id}`);
        Native.vibrate('success');
        queue.splice(i, 1);
        i--;
        changed = true;
        notifyListeners();
      } catch (e) {
        const syncError = normalizeSyncError(e, item);
        notifySupportSyncError(syncError);
        console.error(`[offline] Sync failed for item ${item.id}:`, syncError);
        Native.vibrate('error');
        if (!syncError.isRetryable) {
          queue.splice(i, 1);
          i--;
        } else {
          const attempts = (item.attempts || 0) + 1;
          const delayMs = Math.min(60_000, 2_000 * Math.pow(2, Math.min(attempts, 5)));
          item.attempts = attempts;
          item.nextAttemptAt = Date.now() + delayMs;
          queue[i] = item;
        }
        changed = true;
        notifyListeners();
        if (throwOnError) {
          if (!errorToThrow) errorToThrow = syncError;
          if (syncError.isRetryable) {
            break;
          }
        }
      }
    }
    if (changed) await saveQueue(queue);
  } finally {
    flushing = false;
    notifyListeners();
    console.log('[offline] Sync process finished.');
    if (errorToThrow) throw errorToThrow;
  }
}

export async function enqueueMutation(url, { method = 'POST', headers = {}, body = null } = {}) {
  const upperMethod = (method || 'POST').toUpperCase();
  
  if (isOnline()) {
    const token = getAuthToken();
    const mergedHeaders = {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    };

    // Limpeza de segurança do body antes de enviar
    let finalBody = body;
    if (finalBody != null && typeof finalBody === 'object') {
      finalBody = deepClean(finalBody);
    }
    if (upperMethod === 'PUT' && String(url || '').startsWith('/api/appointments/')) {
      finalBody = await optimizeAppointmentPhotosBody(finalBody);
    }

    // console.log(`[offline] Mutating ${url} | Token length: ${token ? token.length : 0}`);

    try {
      const res = await fetch(getFullUrl(url), {
        method: upperMethod,
        headers: mergedHeaders,
        body: finalBody != null ? (typeof finalBody === 'string' ? finalBody : JSON.stringify(finalBody)) : undefined,
      });

      if (res.status === 401) {
        console.warn(`[offline] 401 Unauthorized para ${url}. Token presente: ${!!token}. Tentando logout...`);
        await handleUnauthorized();
        throw new Error('Sua sessão expirou. Por favor, faça login novamente. [401]');
      }

      if (res.ok) {
        Native.vibrate('success');
        try {
          return await res.json();
        } catch {
          return null;
        }
      }
      let errorDetail = '';
      try {
        errorDetail = (await res.text()).slice(0, 200);
      } catch {
        errorDetail = '';
      }
      throw createSyncError({
        status: res.status,
        detail: errorDetail,
        url,
        method: upperMethod
      });
    } catch (e) {
      if (e.message && e.message.includes('[401]')) {
        throw e;
      }
      const syncError = normalizeSyncError(e, { url, method: upperMethod });
      if (!syncError.isRetryable) {
        notifySupportSyncError(syncError);
        throw syncError;
      }
      console.warn('[offline] Mutation failed, queuing', e);
    }
  }

  Native.vibrate('warning');
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    method: upperMethod,
    body: (upperMethod === 'PUT' && String(url || '').startsWith('/api/appointments/') && body != null && typeof body === 'object')
      ? await optimizeAppointmentPhotosBody(deepClean(body))
      : body,
    contentType: (headers && headers['Content-Type']) || (body != null ? 'application/json' : undefined),
    headers: {}, 
    addedAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  await enqueueRequest(item);
  return { queued: true, queuedId: item.id };
}

export function getQueueStatus() {
  return {
    pending: currentQueue.length,
    isSyncing: flushing
  };
}

export async function flushQueue(options = {}) {
  await flushQueueInternal({ throwOnError: true, ...options });
}

export function getPendingMutations() {
  return currentQueue;
}

export async function removeMutation(id) {
  const queue = [...currentQueue];
  const idx = queue.findIndex(item => item.id === id);
  if (idx >= 0) {
    queue.splice(idx, 1);
    await saveQueue(queue);
    return true;
  }
  return false;
}

export async function clearQueue() {
  await saveQueue([]);
}

export async function clearQueuedMutationsByUrl(urlPrefix) {
  const prefix = String(urlPrefix || '');
  if (!prefix) return 0;
  const queue = [...currentQueue];
  const filtered = queue.filter((item) => !String(item?.url || '').startsWith(prefix));
  if (filtered.length === queue.length) return 0;
  await saveQueue(filtered);
  return queue.length - filtered.length;
}

/**
 * Limpa todo o cache offline (exceto fila de mutações)
 */
export async function clearCache() {
  const allKeys = await Preferences.keys();
  const cacheKeys = allKeys.keys.filter(k => k.startsWith('cache:'));
  for (const key of cacheKeys) {
    await Preferences.remove({ key });
  }
  console.log(`[offline] Cache cleared: ${cacheKeys.length} items.`);
  return cacheKeys.length;
}

/**
 * Pré-carrega uma lista de URLs no cache offline
 */
export async function warmCache(urls) {
  if (!isOnline()) return;
  
  console.log(`[offline] Warming cache for ${urls.length} resources...`);
  
  const promises = urls.map(async (url) => {
    try {
      await offlineFetch(url);
    } catch (e) {
      console.error(`[offline] Warm cache failed for ${url}:`, e);
    }
  });

  await Promise.allSettled(promises);
}

export function useNetworkStatus() {
  const [online, setOnline] = React.useState(isOnline());
  React.useEffect(() => {
    const sub = Network.addListener('networkStatusChange', status => {
      setOnline(status.connected);
    });
    return () => {
      sub.then(s => s.remove());
    };
  }, []);
  return online;
}

// Tenta flush ao carregar
if (typeof window !== 'undefined') {
  setTimeout(flushQueueInternal, 2000);
}
