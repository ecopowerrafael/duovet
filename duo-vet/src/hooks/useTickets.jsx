import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiFetch, getAuthTokenAsync } from '../lib/offline';

const TicketsContext = createContext(null);

const readJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);

  const withAuthHeaders = useCallback(async (headers = {}) => {
    const token = await getAuthTokenAsync();
    return {
      'Content-Type': 'application/json',
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const fetchTickets = useCallback(async ({ status = '', sort = '' } = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (sort) params.set('sort', sort);
      const query = params.toString() ? `?${params.toString()}` : '';
      const headers = await withAuthHeaders();
      const response = await apiFetch(`/api/tickets${query}`, { headers });
      const data = await readJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao buscar tickets');
      }
      setTickets(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } finally {
      setLoading(false);
    }
  }, [withAuthHeaders]);

  const openTicket = useCallback(async (payload) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch('/api/tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível abrir o ticket');
    }
    setTickets((prev) => [data, ...prev]);
    setSelectedTicket(data);
    return data;
  }, [withAuthHeaders]);

  const sendMessage = useCallback(async (ticketId, payload) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível enviar a mensagem');
    }
    setTickets((prev) => prev.map((ticket) => (ticket.id === data.id ? data : ticket)));
    setSelectedTicket((prev) => (prev && prev.id === data.id ? data : prev));
    return data;
  }, [withAuthHeaders]);

  const closeTicket = useCallback(async (ticketId) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch(`/api/tickets/${ticketId}/close`, {
      method: 'PUT',
      headers
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível fechar o ticket');
    }
    setTickets((prev) => prev.map((ticket) => (ticket.id === data.id ? data : ticket)));
    setSelectedTicket((prev) => (prev && prev.id === data.id ? data : prev));
    return data;
  }, [withAuthHeaders]);

  const deleteTicket = useCallback(async (ticketId) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível excluir o ticket');
    }
    setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
    setSelectedTicket((prev) => (prev && prev.id === ticketId ? null : prev));
    return data;
  }, [withAuthHeaders]);

  const assignToMe = useCallback(async (ticketId) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch(`/api/tickets/${ticketId}/assign-me`, {
      method: 'PUT',
      headers
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível atribuir o ticket');
    }
    setTickets((prev) => prev.map((ticket) => (ticket.id === data.id ? data : ticket)));
    setSelectedTicket((prev) => (prev && prev.id === data.id ? data : prev));
    return data;
  }, [withAuthHeaders]);

  const changePriority = useCallback(async (ticketId, priority) => {
    const headers = await withAuthHeaders();
    const response = await apiFetch(`/api/tickets/${ticketId}/priority`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ priority })
    });
    const data = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Não foi possível alterar a prioridade');
    }
    setTickets((prev) => prev.map((ticket) => (ticket.id === data.id ? data : ticket)));
    setSelectedTicket((prev) => (prev && prev.id === data.id ? data : prev));
    return data;
  }, [withAuthHeaders]);

  const value = useMemo(() => ({
    tickets,
    selectedTicket,
    loading,
    setSelectedTicket,
    fetchTickets,
    openTicket,
    sendMessage,
    closeTicket,
    deleteTicket,
    assignToMe,
    changePriority
  }), [
    tickets,
    selectedTicket,
    loading,
    fetchTickets,
    openTicket,
    sendMessage,
    closeTicket,
    deleteTicket,
    assignToMe,
    changePriority
  ]);

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets() {
  const context = useContext(TicketsContext);
  if (!context) {
    throw new Error('useTickets deve ser usado dentro de TicketsProvider');
  }
  return context;
}

export const abrirTicket = (api, payload) => api.openTicket(payload);
export const enviarMensagem = (api, ticketId, payload) => api.sendMessage(ticketId, payload);
export const fecharTicket = (api, ticketId) => api.closeTicket(ticketId);
