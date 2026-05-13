import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Filter, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/AuthContextJWT';
import { TicketsProvider, useTickets } from '../hooks/useTickets';
import NewTicketModal from '../components/tickets/NewTicketModal';
import TicketList from '../components/tickets/TicketList';
import TicketChat from '../components/tickets/TicketChat';
import AdminDashboard from '../components/tickets/AdminDashboard';

function TicketsView() {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@duovet.app';
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortMode, setSortMode] = useState(isAdmin ? 'waiting_time' : '');

  const {
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
  } = useTickets();

  useEffect(() => {
    fetchTickets({ status: statusFilter, sort: sortMode })
      .then((data) => {
        if (!selectedTicket && data.length > 0) {
          setSelectedTicket(data[0]);
        }
      })
      .catch((error) => toast.error(error.message || 'Erro ao carregar tickets'));
  }, [fetchTickets, selectedTicket, setSelectedTicket, sortMode, statusFilter]);

  const selectedTicketId = selectedTicket?.id || null;
  const pendingCount = useMemo(() => tickets.filter((ticket) => ticket.status === 'open').length, [tickets]);

  const handleCreateTicket = async (payload) => {
    setCreatingTicket(true);
    try {
      const created = await openTicket(payload);
      setNewModalOpen(false);
      toast.success('Ticket aberto com sucesso');
      setSelectedTicket(created);
    } catch (error) {
      toast.error(error.message || 'Não foi possível abrir o ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSendMessage = async (payload) => {
    if (!selectedTicketId) return;
    setSending(true);
    try {
      const updated = await sendMessage(selectedTicketId, payload);
      setSelectedTicket(updated);
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      const updated = await closeTicket(ticketId);
      setSelectedTicket(updated);
      toast.success('Ticket encerrado');
    } catch (error) {
      toast.error(error.message || 'Não foi possível encerrar');
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    try {
      await deleteTicket(ticketId);
      setSelectedTicket(null);
      toast.success('Ticket excluído');
    } catch (error) {
      toast.error(error.message || 'Não foi possível excluir');
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-[var(--text-primary)] text-xl flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-[var(--accent)]" />
              Sistema de Suporte
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => fetchTickets({ status: statusFilter, sort: sortMode })}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white" onClick={() => setNewModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Abrir Chamado
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2">
              <Filter className="w-4 h-4 text-[var(--text-muted)]" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-transparent text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="">Todos os status</option>
                <option value="open">Abertos</option>
                <option value="waiting_user">Aguardando usuário</option>
                <option value="closed">Encerrados</option>
              </select>
            </div>
            {isAdmin ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="bg-transparent text-sm text-[var(--text-primary)] outline-none"
                >
                  <option value="waiting_time">Ordenar por tempo de espera</option>
                  <option value="">Mais recentes</option>
                </select>
              </div>
            ) : null}
            <span className="text-sm text-[var(--text-secondary)]">{pendingCount} pendente(s)</span>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <AdminDashboard
          tickets={tickets}
          onChangePriority={async (ticketId, priority) => {
            try {
              await changePriority(ticketId, priority);
              toast.success('Prioridade atualizada');
            } catch (error) {
              toast.error(error.message || 'Erro ao atualizar prioridade');
            }
          }}
          onAssignToMe={async (ticketId) => {
            try {
              await assignToMe(ticketId);
              toast.success('Ticket atribuído');
            } catch (error) {
              toast.error(error.message || 'Erro ao atribuir ticket');
            }
          }}
          onCloseTicket={handleCloseTicket}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <TicketList
            tickets={tickets}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicket}
          />
        </div>
        <div className="lg:col-span-2">
          <TicketChat
            ticket={selectedTicket}
            isAdmin={isAdmin}
            sending={sending}
            onSendMessage={handleSendMessage}
            onCloseTicket={handleCloseTicket}
            onDeleteTicket={handleDeleteTicket}
          />
        </div>
      </div>

      <NewTicketModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onSubmit={handleCreateTicket}
        submitting={creatingTicket}
      />
    </div>
  );
}

export default function Tickets() {
  return (
    <TicketsProvider>
      <TicketsView />
    </TicketsProvider>
  );
}
