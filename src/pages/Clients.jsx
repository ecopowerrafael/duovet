import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Stethoscope,
  MapPin,
  Calendar,
  DollarSign,
  Filter,
  RotateCw
} from 'lucide-react';
import AnimalIcon from '../components/animals/AnimalIcon';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { differenceInDays } from 'date-fns';
import { offlineFetch, enqueueMutation, isOnline } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { compareIds, deepClean, formatCpfCnpj, formatPhoneBr } from '../lib/utils';

export default function Clients() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // Filtros avançados
  const [advancedFilters, setAdvancedFilters] = useState({
    city: '',
    type: '',
    isDelinquent: false,
    daysWithoutAttendance: ''
  });
    // ...existing code...
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    notes: '',
    type: 'produtor'
  });
  const [mainProperty, setMainProperty] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    notes: '',
    distance_km: null
  });
  const [mainAnimal, setMainAnimal] = useState({
    name: '',
    species: '',
    breed: '',
    sex: '',
    birth_date: '',
    notes: ''
  });
  const [propertyError, setPropertyError] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleCepSearch = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    if (!isOnline()) {
      toast.error('Você precisa estar online para buscar o CEP automaticamente');
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setMainProperty(prev => ({
        ...prev,
        city: data.localidade,
        state: data.uf,
        address: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`
      }));
      toast.success('Endereço preenchido automaticamente');
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: clients = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const data = await offlineFetch(`/api/clients${query}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.email
  });

  const { data: animals = [], refetch: refetchAnimals, isLoading: isLoadingAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const res = await offlineFetch(`/api/animals${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: appointments = [], refetch: refetchAppointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const res = await offlineFetch(`/api/appointments${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: properties = [], refetch: refetchProperties, isLoading: isLoadingProperties } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const res = await offlineFetch(`/api/properties${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetch(),
        refetchProperties(),
        refetchAnimals(),
        refetchAppointments()
      ]),
      {
        loading: 'Atualizando dados...',
        success: 'Dados atualizados com sucesso!',
        error: 'Erro ao atualizar dados'
      }
    );
  };

// Listas para selects (depois de properties)
const cityOptions = Array.from(new Set((properties || []).map(p => p && p.city).filter(Boolean)));
const typeOptions = [
  { value: 'produtor', label: 'Produtor Rural' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'empresa', label: 'Empresa/Clínica' }
];

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { 
        ...data.client, 
        property: data.property,
        animal: data.animal,
        created_by: user?.email 
      };

      const finalPayload = deepClean(payload) || {};
      return enqueueMutation('/api/clients', { method: 'POST', body: finalPayload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchProperties(),
        refetchAnimals(),
        refetchAppointments()
      ]);

      toast.success(res?.queued ? 'Cliente enfileirado para sincronização' : 'Cliente cadastrado com sucesso!');
      handleCloseDialog();
    },
    onError: (err) => {
      console.error('[Clients] Erro ao cadastrar cliente:', err);
      toast.error('Erro ao cadastrar cliente: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = deepClean({ ...data }) || {};
      return enqueueMutation(`/api/clients/${id}`, { method: 'PUT', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchProperties(),
        refetchAnimals(),
        refetchAppointments()
      ]);
      
      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Cliente atualizado com sucesso!');
      handleCloseDialog();
    },
    onError: (err) => {
      console.error('[Clients] Erro ao atualizar cliente:', err);
      toast.error('Erro ao atualizar cliente: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return enqueueMutation(`/api/clients/${id}`, { method: 'DELETE' });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchProperties(),
        refetchAnimals(),
        refetchAppointments()
      ]);
      
      toast.success(res?.queued ? 'Remoção enfileirada para sincronização' : 'Cliente removido com sucesso!');
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === 'true') {
      setIsOpen(true);
    }
  }, []);

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingClient(null);
    setFormData({
      name: '',
      document: '',
      phone: '',
      email: '',
      notes: '',
      type: 'produtor'
    });
    setMainProperty({
      name: '',
      city: '',
      state: '',
      address: '',
      notes: '',
      distance_km: null
    });
    setMainAnimal({
      name: '',
      species: '',
      breed: '',
      sex: '',
      birth_date: '',
      notes: ''
    });
    setPropertyError('');
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      document: formatCpfCnpj(client.document || ''),
      phone: formatPhoneBr(client.phone || ''),
      email: client.email || '',
      notes: client.notes || '',
      type: client.type || 'produtor'
    });
    setIsOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingClient && !mainProperty.name) {
      setPropertyError('Propriedade principal é obrigatória para cadastrar um novo cliente');
      return;
    }
    
    // Add client-side validation for property fields if a property is being added
    if (!editingClient) {
       if (!mainProperty.city || !mainProperty.state) {
          setPropertyError('Município e Estado são obrigatórios para a propriedade');
          toast.error('Preencha os dados obrigatórios da propriedade');
          return;
       }
    }
    
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formData });
    } else {
      // Garantir que o endereço tenha pelo menos cidade e estado se o logradouro estiver vazio
      const enhancedProperty = { ...mainProperty };
      if (!enhancedProperty.address && (enhancedProperty.city || enhancedProperty.state)) {
        enhancedProperty.address = [enhancedProperty.city, enhancedProperty.state].filter(Boolean).join(' - ');
      }
      
      createMutation.mutate({ 
        client: formData, 
        property: enhancedProperty, 
        animal: mainAnimal.name ? mainAnimal : null 
      });
    }
  };

  const getClientStats = (clientId) => {
    if (!clientId) return { animalCount: 0, appointmentCount: 0, lastAppointment: null, totalRevenue: 0, daysSinceLastAppointment: null };

    const clientAnimals = (animals || []).filter(a => {
      if (!a) return false;
      
      // Normalização robusta de IDs usando utilitários
      const animalClientId = a.client_id || a.owner_id || a.clientId || a.ownerId || a.id_client;
      const nestedClientId = a.client?.id || a.owner?.id || a.client?._id || a.owner?._id;
      
      return compareIds(animalClientId, clientId) || compareIds(nestedClientId, clientId);
    });
    
    const clientAppointments = (appointments || []).filter(a => {
      if (!a) return false;
      const appClientId = a.client_id || a.clientId || a.id_client;
      return compareIds(appClientId, clientId);
    });
    
    const sortedAppointments = [...clientAppointments].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    const lastAppointment = sortedAppointments[0];
    const totalRevenue = clientAppointments.reduce((sum, app) => sum + (Number(app.total_amount) || 0), 0);
    
    let daysSinceLastAppointment = null;
    if (lastAppointment && lastAppointment.date) {
      try {
        const date = new Date(lastAppointment.date);
        if (!isNaN(date.getTime())) {
          daysSinceLastAppointment = differenceInDays(new Date(), date);
        }
      } catch (err) {
        // Ignore parsing errors
      }
    }

    return {
      animalCount: clientAnimals.length,
      appointmentCount: clientAppointments.length,
      lastAppointment,
      totalRevenue,
      daysSinceLastAppointment
    };
  };

  const getClientCardSpecies = (clientId) => {
    if (!clientId) return 'outro';

    const clientAnimals = (animals || []).filter((animal) => {
      if (!animal) return false;
      const animalClientId = animal.client_id || animal.clientId || animal.id_client || animal.owner_id || animal.ownerId;
      const nestedClientId = animal.client?.id || animal.client?._id || animal.owner?.id || animal.owner?._id;
      return compareIds(animalClientId, clientId) || compareIds(nestedClientId, clientId);
    });

    if (clientAnimals.length === 0) return 'outro';

    const speciesSet = new Set(
      clientAnimals
        .map((animal) => (animal?.species || '').toString().trim().toLowerCase())
        .filter(Boolean)
    );

    if (speciesSet.size > 1) return 'equino';

    const [singleSpecies] = speciesSet;
    return singleSpecies || 'outro';
  };

  const enrichedClients = (clients || []).map(client => {
    if (!client) return null;
    const clientId = client.id || client._id;
    return {
      ...client,
      ...getClientStats(clientId),
      mainProperty: (properties || []).find(p => p && compareIds(p.client_id || p.clientId || p.id_client, clientId))
    };
  }).filter(Boolean);

  const filteredClients = enrichedClients.filter(client => {
    if (!client) return false;
    
    const clientId = client.id || client._id;
    // Busca inteligente: nome, CPF/CNPJ, telefone, nome do animal vinculado
    const search = (searchTerm || '').trim().toLowerCase();
    let matchesSearch = false;
    if (!search) {
      matchesSearch = true;
    } else {
      // Nome do cliente
      if ((client.name || '').toLowerCase().includes(search)) matchesSearch = true;
      // Documento (CPF/CNPJ)
      if ((client.document || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''))) matchesSearch = true;
      // Telefone
      if ((client.phone || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''))) matchesSearch = true;
      // Nome da propriedade
      if ((client.mainProperty?.name || '').toLowerCase().includes(search)) matchesSearch = true;
      // Nome do animal vinculado
      if ((animals || []).some(a => {
        const animalClientId = a.client_id || a.owner_id || a.clientId || a.ownerId || a.id_client;
        return compareIds(animalClientId, clientId) && (a.name || '').toLowerCase().includes(search);
      })) matchesSearch = true;
    }

    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && client.appointmentCount > 0) ||
      (filterStatus === 'inactive' && client.appointmentCount === 0) ||
      (filterStatus === 'recent' && client.daysSinceLastAppointment !== null && client.daysSinceLastAppointment <= 30) ||
      (filterStatus === 'old' && (client.daysSinceLastAppointment === null || client.daysSinceLastAppointment > 90));

    // Se estivermos procurando por um termo específico, ignoramos o filtro de status para facilitar o encontro
    const finalMatchesStatus = searchTerm ? true : matchesStatus;

    // Filtros avançados
    const matchesCity = !advancedFilters.city || client.mainProperty?.city === advancedFilters.city;
    const matchesType = !advancedFilters.type || client.type === advancedFilters.type;
    const matchesDelinquent = !advancedFilters.isDelinquent || (client.totalRevenue < client.appointmentCount * 1); // Exemplo: ajuste conforme regra real
    const matchesDays = !advancedFilters.daysWithoutAttendance || (client.daysSinceLastAppointment !== null && client.daysSinceLastAppointment >= Number(advancedFilters.daysWithoutAttendance));

    return matchesSearch && finalMatchesStatus && matchesCity && matchesType && matchesDelinquent && matchesDays;
  }).sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'animals') return (b.animalCount || 0) - (a.animalCount || 0);
    if (sortBy === 'lastAppointment') {
      const daysA = a.daysSinceLastAppointment !== null ? a.daysSinceLastAppointment : Infinity;
      const daysB = b.daysSinceLastAppointment !== null ? b.daysSinceLastAppointment : Infinity;
      return daysA - daysB;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header - iOS Mobile Friendly */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-3xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">Clientes</h1>
          <p className="text-[var(--text-muted)] mt-0.5 text-sm font-medium">Gerencie seus clientes e relacionamento</p>
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
          <Button 
            onClick={() => window.location.href = createPageUrl('Properties') + '?new=true'} 
            variant="outline"
            className="w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold"
          >
            <MapPin className="w-5 h-5" />
            Nova Propriedade
          </Button>
          <Button 
            onClick={() => setIsOpen(true)} 
            className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-2xl font-semibold shadow-lg shadow-[var(--accent)]/25"
          >
            <Plus className="w-5 h-5" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filters - Desktop */}
      <div className="hidden md:flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar por nome, documento ou propriedade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-48 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos</option>
          <option value="active">Com atendimentos</option>
          <option value="inactive">Sem atendimentos</option>
          <option value="recent">Atendidos recentemente</option>
          <option value="old">Sem atendimento há 90+ dias</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-48 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="name">Nome</option>
          <option value="animals">Total de Animais</option>
          <option value="lastAppointment">Último Atendimento</option>
        </select>
        <Button variant="outline" className="h-12 rounded-xl" onClick={() => setIsFilterOpen(true)}>
          <Filter className="w-4 h-4 mr-2" /> Filtro Avançado
        </Button>
      </div>

      {/* Drawer/Modal de Filtros Avançados */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700" onClick={() => setIsFilterOpen(false)}>
              <span className="text-xl">×</span>
            </button>
            <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">Filtros Avançados</h2>
            <div className="space-y-4">
              {/* Cidade */}
              <div>
                <Label className="mb-1">Cidade</Label>
                <select
                  value={advancedFilters.city}
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, city: e.target.value }))}
                  className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Todas</option>
                  {cityOptions.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              {/* Tipo */}
              <div>
                <Label className="mb-1">Tipo de Cliente</Label>
                <select
                  value={advancedFilters.type}
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Todos</option>
                  {typeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {/* Inadimplente */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="delinquent"
                  checked={advancedFilters.isDelinquent}
                  onChange={e => setAdvancedFilters(f => ({ ...f, isDelinquent: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <Label htmlFor="delinquent">Somente inadimplentes</Label>
              </div>
              {/* Sem atendimento há X dias */}
              <div>
                <Label className="mb-1">Sem atendimento há (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={advancedFilters.daysWithoutAttendance}
                  onChange={e => setAdvancedFilters(f => ({ ...f, daysWithoutAttendance: e.target.value }))}
                  placeholder="Ex: 90"
                  className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" className="flex-1" onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAdvancedFilters({ city: '', type: '', isDelinquent: false, daysWithoutAttendance: '' })}>Limpar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* End Advanced Filter Modal */}
      {/* Mobile Filter Button & Search */}
      <div className="md:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-2xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <Button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          variant="outline"
          className="w-full h-12 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] gap-2 font-semibold"
        >
          <Filter className="w-5 h-5" />
          Filtrar
          {(filterStatus !== 'all' || sortBy !== 'name') && (
            <Badge className="bg-[#22c55e] text-white ml-2 h-5 px-2 rounded-full">
              {[filterStatus, sortBy].filter(f => f !== 'all' && f !== 'name').length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile Filter Content - Collapsible */}
      {isFilterOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden overflow-hidden"
        >
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label className="text-sm mb-2 font-semibold">Status</Label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos</option>
                  <option value="active">Com atendimentos</option>
                  <option value="inactive">Sem atendimentos</option>
                  <option value="recent">Atendidos recentemente</option>
                  <option value="old">Sem atendimento há 90+ dias</option>
                </select>
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Ordenar por</Label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="name">Nome</option>
                  <option value="animals">Animais</option>
                  <option value="lastAppointment">Último Atendimento</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Clients Grid */}
      {isLoading || isLoadingAnimals || isLoadingAppointments || isLoadingProperties ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </p>
          <p className="text-[var(--text-muted)] mt-1">
            {searchTerm ? 'Tente uma busca diferente' : 'Comece adicionando seu primeiro cliente'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all group relative overflow-hidden">
                <Link 
                  to={createPageUrl('ClientDetail') + `?id=${client.id}`}
                  className="block p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {client.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                          {client.name}
                        </h3>
                        {client.document && (
                          <p className="text-xs text-[var(--text-muted)]">{client.document}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button variant="ghost" size="icon" className="rounded-lg relative z-10">
                          <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="cursor-pointer">
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('Properties') + `?new=true&client_id=${client.id}`} className="cursor-pointer">
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Propriedade
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('Properties') + `?client_id=${client.id}`} className="cursor-pointer">
                            <MapPin className="w-4 h-4 mr-2" />
                            Ver Propriedades
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl('NewAppointment') + `?client=${client.id}`} className="cursor-pointer">
                            <Stethoscope className="w-4 h-4 mr-2" />
                            Novo Atendimento
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }}
                          className="text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {client.mainProperty && (
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="line-clamp-1 break-words">{client.mainProperty.name}</span>
                      </div>
                      {client.mainProperty.distance_km && (
                        <div className="flex items-center gap-2 text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-1 rounded-lg w-fit">
                          <span className="whitespace-nowrap">📍 {client.mainProperty.distance_km} km</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border-color)]">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AnimalIcon
                          species={getClientCardSpecies(client.id || client._id)}
                          className="w-3.5 h-3.5"
                          white={false}
                        />
                        <span className="font-bold text-[var(--text-primary)]">{client.animalCount}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-semibold">Animais</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Stethoscope className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                        <span className="font-bold text-[var(--text-primary)]">{client.appointmentCount}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-semibold">Atend.</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                        <span className="font-bold text-[var(--text-primary)] text-xs break-all">
                          {(client.totalRevenue / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] font-semibold">Total</span>
                    </div>
                  </div>

                  {client.lastAppointment && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="break-words">
                          Último atendimento há {client.daysSinceLastAppointment} {client.daysSinceLastAppointment === 1 ? 'dia' : 'dias'}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {editingClient ? 'editar' : 'cadastrar'} um cliente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client Info */}
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
                required
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Cliente</Label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={formData.document}
                onChange={(e) => setFormData({ ...formData, document: formatCpfCnpj(e.target.value) })}
                placeholder="000.000.000-00"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneBr(e.target.value) })}
                placeholder="(00) 00000-0000"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o cliente..."
                rows={2}
                className="rounded-xl"
              />
            </div>

            {/* Separator */}
            {editingClient ? (
               <div className="border-t border-[var(--border-color)] pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--accent)]" />
                      Propriedades
                    </h4>
                    <Link 
                      to={`/properties?client_id=${editingClient.id}`}
                      className="text-sm text-[var(--accent)] hover:underline font-medium"
                    >
                      Gerenciar Propriedades
                    </Link>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Para editar ou adicionar propriedades, acesse o gerenciador de propriedades.
                  </p>
               </div>
            ) : (
              <>
                <div className="border-t border-[var(--border-color)] pt-4">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    Propriedade Principal *
                  </h4>
                </div>

                {propertyError && (
                  <div className="p-3 bg-red-500/10 border border-red-200 rounded-lg text-sm text-red-600">
                    {propertyError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Nome da Propriedade *</Label>
                  <Input
                    value={mainProperty.name}
                    onChange={(e) => {
                      setMainProperty({ ...mainProperty, name: e.target.value });
                      if (e.target.value) setPropertyError('');
                    }}
                    placeholder="Ex: Fazenda da Seara"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.replace(/\D/g, '').length === 8) {
                          handleCepSearch(val);
                        }
                      }}
                      className="h-12 rounded-xl pr-10"
                    />
                    {isSearchingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Município</Label>
                    <Input
                      value={mainProperty.city}
                      onChange={(e) => setMainProperty({ ...mainProperty, city: e.target.value })}
                      placeholder="Ex: São Paulo"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={mainProperty.state}
                      onChange={(e) => setMainProperty({ ...mainProperty, state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={mainProperty.address}
                    onChange={(e) => setMainProperty({ ...mainProperty, address: e.target.value })}
                    placeholder="Rua, número, bairro"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                   <Label>Observações</Label>
                   <Textarea
                     value={mainProperty.notes}
                     onChange={(e) => setMainProperty({ ...mainProperty, notes: e.target.value })}
                     placeholder="Notas sobre a propriedade..."
                     rows={2}
                     className="rounded-xl"
                   />
                 </div>

                {/* Distance Section (Manual Only) */}
                <div className="border-t border-[var(--border-color)] pt-4">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    Distância até a Propriedade
                  </h4>
                  <div className="space-y-2">
                    <Label>Distância (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={mainProperty.distance_km || ''}
                      onChange={(e) => setMainProperty({ ...mainProperty, distance_km: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Ex: 45.5"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                {/* Animal Section (Optional) */}
                <div className="border-t border-[var(--border-color)] pt-4">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <AnimalIcon species={mainAnimal.species || "outro"} className="w-4 h-4" white={false} />
                    Animal (Opcional)
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Animal</Label>
                      <Input
                        value={mainAnimal.name}
                        onChange={(e) => setMainAnimal({ ...mainAnimal, name: e.target.value })}
                        placeholder="Ex: Estrela"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Espécie</Label>
                        <select
                          value={mainAnimal.species}
                          onChange={(e) => setMainAnimal({ ...mainAnimal, species: e.target.value })}
                          className="w-full h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3"
                        >
                          <option value="">Selecione...</option>
                          <option value="bovino">Bovino</option>
                          <option value="equino">Equino</option>
                          <option value="ovino">Ovino</option>
                          <option value="caprino">Caprino</option>
                          <option value="suino">Suíno</option>
                          <option value="bubalino">Bubalino</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Raça</Label>
                        <Input
                          value={mainAnimal.breed}
                          onChange={(e) => setMainAnimal({ ...mainAnimal, breed: e.target.value })}
                          placeholder="Ex: Nelore"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Sexo</Label>
                        <select
                          value={mainAnimal.sex}
                          onChange={(e) => setMainAnimal({ ...mainAnimal, sex: e.target.value })}
                          className="w-full h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3"
                        >
                          <option value="">Selecione...</option>
                          <option value="M">Macho</option>
                          <option value="F">Fêmea</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Data de Nasc.</Label>
                        <Input
                          type="date"
                          value={mainAnimal.birth_date}
                          onChange={(e) => setMainAnimal({ ...mainAnimal, birth_date: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 h-12 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700" 
                onClick={handleCloseDialog}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-semibold shadow-md transition-all dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingClient ? 'Salvar' : 'Cadastrar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
