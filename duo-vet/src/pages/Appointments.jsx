import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Plus,
  Search,
  Stethoscope,
  Filter,
  RotateCw
} from 'lucide-react';
import AppointmentCard from '../components/appointments/AppointmentCard';
import { offlineFetch, enqueueMutation, getPendingMutations, flushQueue } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { compareIds } from '../lib/utils';
import {
  getAppointmentAnimalIds,
  getAppointmentClientId,
  getAppointmentPropertyId,
  normalizeAppointmentForAnalysis
} from '../lib/appointments';
import { toast } from 'sonner';

const TYPES = [
  { value: 'clinico', label: 'Clínico', color: 'bg-blue-100 text-blue-700' },
  { value: 'reprodutivo', label: 'Reprodutivo', color: 'bg-pink-100 text-pink-700' },
  { value: 'cirurgico', label: 'Cirúrgico', color: 'bg-red-100 text-red-700' },
  { value: 'sanitario', label: 'Sanitário', color: 'bg-green-100 text-green-700' },
  { value: 'preventivo', label: 'Preventivo', color: 'bg-purple-100 text-purple-700' },
  { value: 'consultoria', label: 'Consultoria', color: 'bg-cyan-100 text-cyan-700' }
];

const STATUS = [
  { value: 'em_andamento', label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  { value: 'finalizado', label: 'Finalizado', color: 'bg-green-100 text-green-700' },
  { value: 'faturado', label: 'Faturado', color: 'bg-purple-100 text-purple-700' }
];

export default function Appointments() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { user } = useAuth();

  const { data: appointments = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/appointments?created_by=${isAdmin ? '' : (email || '')}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  // Get pending appointments from offline queue
  const pendingMutations = getPendingMutations();
  const pendingAppointments = pendingMutations
    .filter(m => m.url.includes('/api/appointments') && m.method === 'POST')
    .map(m => ({
      ...(normalizeAppointmentForAnalysis(m.body) || {}),
      id: m.id,
      isPending: true
    }));

  const normalizedAppointments = (appointments || [])
    .map((appointment) => normalizeAppointmentForAnalysis(appointment))
    .filter(Boolean);
  const allAppointments = [...pendingAppointments, ...normalizedAppointments];

  const deleteAppointmentMutation = useMutation({
    mutationFn: (appointmentId) => enqueueMutation(`/api/appointments/${appointmentId}`, { method: 'DELETE' }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['payments', user?.email] });
      toast.success(res?.queued ? 'Exclusão enfileirada para sincronização' : 'Atendimento excluído com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir atendimento: ${error?.message || 'Erro desconhecido'}`);
    }
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/clients?created_by=${isAdmin ? '' : (email || '')}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: properties = [], refetch: refetchProperties } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/properties?created_by=${isAdmin ? '' : (email || '')}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: animals = [], refetch: refetchAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/animals?created_by=${isAdmin ? '' : (email || '')}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: lots = [], refetch: refetchLots } = useQuery({
    queryKey: ['lots', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/lots?created_by=${isAdmin ? '' : (email || '')}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    // Primeiro tenta sincronizar alterações pendentes se houver
    if (pendingAppointments.length > 0) {
      try {
        await flushQueue({ force: true });
        toast.success('Alterações sincronizadas com sucesso!');
      } catch (err) {
        console.error('Erro ao sincronizar na atualização manual:', err);
        // Não lançamos erro aqui para permitir que o refetch continue
      }
    }

    toast.promise(
      Promise.all([
        refetch(),
        refetchClients(),
        refetchProperties(),
        refetchAnimals(),
        refetchLots()
      ]),
      {
        loading: 'Atualizando atendimentos...',
        success: 'Atendimentos atualizados!',
        error: 'Erro ao atualizar atendimentos'
      }
    );
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === 'true') {
      window.location.href = createPageUrl('NewAppointment');
    }
  }, []);

  const getClientName = (clientId) => {
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, clientId));
    return client?.name || '-';
  };

  const getPropertyName = (propertyId) => {
    const property = (properties || []).find(p => p && compareIds(p.id || p._id, propertyId));
    return property?.name || '-';
  };

  const getAnimalNames = (animalIds) => {
    if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) return [];
    return (animalIds || [])
      .map(id => (animals || []).find(a => a && String(a.id || '') === String(id || ''))?.name)
      .filter(Boolean);
  };

  const getLotName = (lotId) => {
    if (!lotId) return null;
    const lot = (lots || []).find(l => l && String(l.id || '') === String(lotId || ''));
    return lot?.name;
  };

  const getSpecies = (appointment) => {
    if (appointment?.lot_id) {
      const lot = (lots || []).find(l => l && compareIds(l.id || l._id, appointment.lot_id));
      return lot?.species || 'bovino';
    }
    const appointmentAnimalIds = getAppointmentAnimalIds(appointment);
    if (appointmentAnimalIds.length > 0) {
      const animal = (animals || []).find(a => a && compareIds(a.id || a._id, appointmentAnimalIds[0]));
      return animal?.species || 'bovino';
    }
    if (appointment?.animal_id) {
      const animal = (animals || []).find(a => a && compareIds(a.id || a._id, appointment.animal_id));
      return animal?.species || 'bovino';
    }
    return 'bovino';
  };

  const handleGenerateReport = async (appointmentId) => {
    const app = (filteredAppointments || []).find(a => a && String(a.id || '') === String(appointmentId || ''));
    if (!app) return;

    // Redirect to detail page and trigger PDF generation
    window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=generatePDF`;
  };

  const handleSendWhatsApp = async (appointmentId) => {
    const app = (filteredAppointments || []).find(a => a && compareIds(a.id || a._id, appointmentId));
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, getAppointmentClientId(app)));

    if (!client?.phone) {
      alert('Cliente não possui número de WhatsApp cadastrado');
      return;
    }

    // Redirect to detail page and trigger WhatsApp send
    window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=sendWhatsApp`;
  };

  const handleDeleteAppointment = (appointmentId) => {
    const appointment = (allAppointments || []).find(a => a && compareIds(a.id || a._id, appointmentId));
    if (!appointment) return;
    if (appointment.isPending) {
      toast.info('Aguarde a sincronização do atendimento para poder excluí-lo');
      return;
    }
    if (appointment.status !== 'em_andamento') {
      toast.info('Só é possível excluir atendimentos antes da finalização');
      return;
    }
    const confirmed = window.confirm('Deseja realmente excluir este atendimento? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    deleteAppointmentMutation.mutate(appointmentId);
  };

  const filteredAppointments = allAppointments
    .filter(appointment => {
      const matchesSearch =
        getClientName(getAppointmentClientId(appointment))?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPropertyName(getAppointmentPropertyId(appointment))?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || appointment.type === filterType;
      const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;

      if (searchTerm) return matchesSearch;

      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = a?.date ? new Date(a.date).getTime() : 0;
      const dateB = b?.date ? new Date(b.date).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      const idA = Number(a?.id || 0);
      const idB = Number(b?.id || 0);
      return idB - idA;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Atendimentos</h1>
          <p className="text-[var(--text-muted)] mt-0.5 text-sm font-medium">Gerencie seu histórico clínico</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            disabled={isRefetching}
            className={`w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold ${isRefetching ? 'animate-pulse' : ''}`}
          >
            <RotateCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Link to={createPageUrl('NewAppointment')} className="w-full md:w-auto">
            <Button className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-2xl font-semibold">
              <Plus className="w-5 h-5" />
              Novo Atendimento
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar por cliente ou propriedade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <div className="relative w-full lg:w-auto">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full lg:w-40 h-12 pl-10 pr-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none"
          >
            <option value="all">Todos os tipos</option>
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="relative w-full lg:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full lg:w-40 h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="all">Todos status</option>
            {STATUS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-10 h-10 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            {searchTerm ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento registrado'}
          </p>
          <p className="text-[var(--text-muted)] mt-1">
            {searchTerm ? 'Tente ajustar os filtros' : 'Comece criando seu primeiro atendimento'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-3">
          {filteredAppointments.map((appointment, index) => (
            <div key={appointment.id || appointment._id} className="lg:col-span-2 min-w-0">
              <AppointmentCard
                appointment={appointment}
                clientName={getClientName(getAppointmentClientId(appointment))}
                propertyName={getPropertyName(getAppointmentPropertyId(appointment))}
                animalNames={getAnimalNames(getAppointmentAnimalIds(appointment))}
                lotName={getLotName(appointment.lot_id)}
                species={getSpecies(appointment)}
                index={index}
                onViewDetails={(id) => { window.location.href = createPageUrl('AppointmentDetail') + `?id=${id}`; }}
                onGenerateReport={handleGenerateReport}
                onSendWhatsApp={handleSendWhatsApp}
                onDelete={handleDeleteAppointment}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
