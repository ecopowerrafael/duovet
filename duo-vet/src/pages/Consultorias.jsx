import React, { useState } from 'react';
// import { base44 } from '../api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Pencil, Trash2, Lightbulb, Filter, Calendar as CalendarIcon, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compareIds } from '../lib/utils';
import { cn } from '../lib/utils';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { createPageUrl } from '../utils';

const safeFormatDate = (dateStr, formatStr = 'dd/MM/yyyy') => {
  try {
    if (!dateStr) return 'Data não informada';
    const date = new Date(dateStr);
    if (!isValid(date)) return 'Data inválida';
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return 'Erro na data';
  }
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const raw = value.trim();
  if (!raw) return 0;
  let normalized = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const str = String(value);
  return str.includes('T') ? str.slice(0, 10) : str;
};

const toCalendarValue = (value) => {
  const normalized = toDateInputValue(value);
  if (!normalized) return undefined;
  const date = new Date(`${normalized}T12:00:00`);
  return isValid(date) ? date : undefined;
};

import { offlineFetch, enqueueMutation } from '../lib/offline';

const TECHNICAL_AREAS = [
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'reproducao', label: 'Reprodução' },
  { value: 'sanidade', label: 'Sanidade' },
  { value: 'manejo', label: 'Manejo' },
  { value: 'outro', label: 'Outro' }
];

const FREQUENCIES = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' }
];

const TYPE_BADGES = {
  pontual: 'bg-blue-100 text-blue-700',
  recorrente: 'bg-purple-100 text-purple-700'
};

const STATUS_BADGES = {
  ativa: 'bg-green-100 text-green-700',
  encerrada: 'bg-gray-100 text-gray-700',
  suspensa: 'bg-amber-100 text-amber-700'
};

const AREA_COLORS = {
  nutricao: 'bg-orange-100 text-orange-700',
  reproducao: 'bg-pink-100 text-pink-700',
  sanidade: 'bg-red-100 text-red-700',
  manejo: 'bg-green-100 text-green-700',
  outro: 'bg-gray-100 text-gray-700'
};

export default function Consultorias() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingConsultancy, setEditingConsultancy] = useState(null);
  const [profileConsultancy, setProfileConsultancy] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    property_id: '',
    type: 'pontual',
    technical_area: '',
    scope: '',
    start_date: '',
    end_date: '',
    status: 'ativa',
    frequency: '',
    next_return_date: '',
    payment_date: '',
    value: '',
    billing_type: '',
    observations: '',
    technical_notes: ''
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: consultancies = [], isLoading } = useQuery({
    queryKey: ['consultancies', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/consultancies' : `/api/consultancies?created_by=${email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/appointments?sort=-date' : `/api/appointments?created_by=${email || ''}&sort=-date`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const createMutation = useMutation(/** @type {any} */({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        created_by: user?.email
      };
      return enqueueMutation('/api/consultancies', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['consultancies'] });
      await queryClient.invalidateQueries({ queryKey: ['consultancies', user?.email] });
      toast.success(res?.queued ? 'Consultoria enfileirada para sincronização' : 'Consultoria cadastrada com sucesso!');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('[Consultorias] Error creating consultancy:', error);
      toast.error('Erro ao cadastrar consultoria');
    }
  }));

  const updateMutation = useMutation(/** @type {any} */({
    mutationFn: async ({ id, data }) => {
      return enqueueMutation(`/api/consultancies/${id}`, { 
        method: 'PUT', 
        body: { ...data, created_by: user?.email } 
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['consultancies'] });
      await queryClient.invalidateQueries({ queryKey: ['consultancies', user?.email] });
      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Consultoria atualizada com sucesso!');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('[Consultorias] Error updating consultancy:', error);
      toast.error('Erro ao atualizar consultoria');
    }
  }));

  const deleteMutation = useMutation(/** @type {any} */({
    mutationFn: async (id) => {
      return enqueueMutation(`/api/consultancies/${id}`, { method: 'DELETE' });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['consultancies'] });
      toast.success(res?.queued ? 'Remoção enfileirada para sincronização' : 'Consultoria removida com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir consultoria');
    }
  }));

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingConsultancy(null);
    setFormData({
      client_id: '',
      property_id: '',
      type: 'pontual',
      technical_area: '',
      scope: '',
      start_date: '',
      end_date: '',
      status: 'ativa',
      frequency: '',
      next_return_date: '',
      payment_date: '',
      value: '',
      billing_type: '',
      observations: '',
      technical_notes: ''
    });
  };

  const handleEdit = (consultancy) => {
    setEditingConsultancy(consultancy);
    setFormData({
      client_id: consultancy.client_id || '',
      property_id: consultancy.property_id || '',
      type: consultancy.type || 'pontual',
      technical_area: consultancy.technical_area || '',
      scope: consultancy.scope || '',
      start_date: toDateInputValue(consultancy.start_date),
      end_date: toDateInputValue(consultancy.end_date),
      status: consultancy.status || 'ativa',
      frequency: consultancy.frequency || '',
      next_return_date: toDateInputValue(consultancy.next_return_date),
      payment_date: toDateInputValue(consultancy.payment_date),
      value: consultancy.value?.toString() || '',
      billing_type: consultancy.billing_type || 'unica',
      observations: consultancy.observations || '',
      technical_notes: consultancy.technical_notes || ''
    });
    setIsOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validação básica
    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }

    if (!formData.property_id) {
      toast.error('Selecione uma propriedade');
      return;
    }

    if (!formData.technical_area) {
      toast.error('Selecione a área técnica');
      return;
    }

    if (!formData.scope) {
      toast.error('Informe o escopo da consultoria');
      return;
    }

    if (!formData.start_date) {
      toast.error('Informe a data de início');
      return;
    }

    const payload = {
      ...formData,
      scope: formData.scope?.trim() || '',
      technical_notes: formData.technical_notes?.trim() || '',
      observations: formData.observations?.trim() || '',
      end_time: null,
      value: formData.value === '' ? null : toNumber(formData.value)
    };

    if (editingConsultancy) {
      const consultancyId = editingConsultancy.id || editingConsultancy._id;
      updateMutation.mutate(/** @type {any} */ ({ id: consultancyId, data: payload }));
    } else {
      createMutation.mutate(/** @type {any} */ (payload));
    }
  };

  const handleFinalize = (consultancy) => {
    const consultancyId = consultancy.id || consultancy._id;
    if (!consultancyId) {
      toast.error('Consultoria inválida');
      return;
    }
    updateMutation.mutate(/** @type {any} */ ({
      id: consultancyId,
      data: {
        ...consultancy,
        status: 'encerrada'
      }
    }));
  };

  const openProfile = (consultancy) => {
    setProfileConsultancy(consultancy);
    setIsProfileOpen(true);
  };

  const closeProfile = () => {
    setIsProfileOpen(false);
    setProfileConsultancy(null);
  };

  const getConsultancyReports = (consultancy) => {
    if (!consultancy) return [];
    const consultancyId = consultancy.id || consultancy._id;
    const consultancyPropertyId = consultancy.property_id || consultancy.propertyId;
    const startValue = toDateInputValue(consultancy.start_date);
    const endValue = toDateInputValue(consultancy.end_date);
    const start = startValue ? new Date(`${startValue}T00:00:00`) : null;
    const end = endValue ? new Date(`${endValue}T23:59:59`) : null;

    return (appointments || [])
      .filter((appt) => appt && appt.type === 'consultoria')
      .filter((appt) => {
        if (!consultancyId) return true;
        const appointmentConsultancyId = appt.consultoria_data?.consultancy_id || appt.consultoria_data?.consultancyId || appt.consultancy_id;
        if (!appointmentConsultancyId) return true;
        return compareIds(appointmentConsultancyId, consultancyId);
      })
      .filter((appt) => compareIds(appt.client_id || appt.clientId, consultancy.client_id))
      .filter((appt) => {
        const appointmentPropertyId = appt.property_id || appt.propertyId;
        if (!consultancyPropertyId && !appointmentPropertyId) return true;
        if (!consultancyPropertyId || !appointmentPropertyId) return false;
        return compareIds(appointmentPropertyId, consultancyPropertyId);
      })
      .filter((appt) => (appt.status === 'finalizado' || appt.status === 'faturado'))
      .filter((appt) => {
        if (!appt.date) return false;
        const apptDate = new Date(appt.date);
        if (!isValid(apptDate)) return false;
        if (start && apptDate < start) return false;
        if (end && apptDate > end) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getConsultancyReportCount = (consultancy) => getConsultancyReports(consultancy).length;

  const getClientName = (clientId) => {
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, clientId));
    return client?.name || '-';
  };

  const getPropertyName = (propertyId) => {
    const property = (properties || []).find(p => p && compareIds(p.id || p._id, propertyId));
    return property?.name || '-';
  };

  const getAreaLabel = (area) => {
    return (TECHNICAL_AREAS || []).find(a => a.value === area)?.label || area;
  };

  const clientProperties = (properties || []).filter(p => p && compareIds(p.client_id, formData.client_id));

  const selectedStartDate = toCalendarValue(formData.start_date);
  const selectedEndDate = toCalendarValue(formData.end_date);
  const selectedPaymentDate = toCalendarValue(formData.payment_date);

  const filteredConsultancies = (consultancies || [])
    .filter(c => {
      if (!c) return false;
      const matchesSearch =
        getClientName(c.client_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPropertyName(c.property_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.scope || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = filterClient === 'all' || compareIds(c.client_id, filterClient);
      const matchesProperty = filterProperty === 'all' || compareIds(c.property_id, filterProperty);
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesType = filterType === 'all' || c.type === filterType;
      return matchesSearch && matchesClient && matchesProperty && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      const dateA = a?.start_date ? new Date(a.start_date).getTime() : 0;
      const dateB = b?.start_date ? new Date(b.start_date).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#22c55e]" />
            Consultorias
          </h1>
          <p className="text-[var(--text-muted)] mt-1">Gestão de consultorias técnicas e acompanhamentos</p>
        </div>
        <Button 
          onClick={() => setIsOpen(true)} 
          className="bg-[#22c55e] hover:bg-[#16a34a] text-white gap-2 h-12 px-6 rounded-xl font-medium shadow-md"
        >
          <Plus className="w-5 h-5" />
          Nova Consultoria
        </Button>
      </div>

      {/* Filters - Desktop */}
      <div className="hidden md:flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar por cliente, propriedade, escopo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="w-48 h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos clientes</option>
          {clients.map((c) => (
            <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-40 h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos status</option>
          <option value="ativa">Ativa</option>
          <option value="encerrada">Encerrada</option>
          <option value="suspensa">Suspensa</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-40 h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos tipos</option>
          <option value="pontual">Pontual</option>
          <option value="recorrente">Recorrente</option>
        </select>
      </div>

      {/* Mobile Search & Filter */}
      <div className="md:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar consultoria..."
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
          {[filterClient, filterStatus, filterType].filter(f => f !== 'all').length > 0 && (
            <Badge className="bg-[#22c55e] text-white ml-2 h-5 px-2 rounded-full">
              {[filterClient, filterStatus, filterType].filter(f => f !== 'all').length}
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
            <CardContent className="p-5 space-y-5">
              <div>
                <Label className="text-sm mb-2 font-semibold">Cliente</Label>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full h-12 px-3 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos clientes</option>
                  {clients.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Status</Label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-12 px-3 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos status</option>
                  <option value="ativa">Ativa</option>
                  <option value="encerrada">Encerrada</option>
                  <option value="suspensa">Suspensa</option>
                </select>
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Tipo</Label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full h-12 px-3 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos tipos</option>
                  <option value="pontual">Pontual</option>
                  <option value="recorrente">Recorrente</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Consultancies Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[#22c55e]/20 border-t-[#22c55e] rounded-full animate-spin"></div>
        </div>
      ) : filteredConsultancies.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-10 h-10 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            {searchTerm ? 'Nenhuma consultoria encontrada' : 'Nenhuma consultoria cadastrada'}
          </p>
          <p className="text-[var(--text-muted)] mt-1">
            {searchTerm ? 'Tente ajustar os filtros' : 'Comece adicionando sua primeira consultoria'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConsultancies.map((consultancy, index) => (
            <motion.div
              key={consultancy.id || consultancy._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[#22c55e]/50 transition-all h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {getClientName(consultancy.client_id)}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {getPropertyName(consultancy.property_id)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-lg">
                          <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => openProfile(consultancy)} className="cursor-pointer">
                          <FileText className="w-4 h-4 mr-2" />
                          Perfil / Relatórios
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(consultancy)} className="cursor-pointer">
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {consultancy.status !== 'encerrada' && (
                          <DropdownMenuItem
                            onClick={() => handleFinalize(consultancy)}
                            className="cursor-pointer"
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Finalizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir esta consultoria?')) {
                              deleteMutation.mutate(consultancy.id || consultancy._id);
                            }
                          }}
                          className="text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-3">
                    {/* Scope */}
                    <div className="p-2 bg-[var(--bg-tertiary)] rounded-lg">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Escopo</p>
                      <p className="text-sm text-[var(--text-primary)] line-clamp-2">{consultancy.scope}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge className={TYPE_BADGES[consultancy.type]}>
                        {consultancy.type === 'pontual' ? 'Pontual' : 'Recorrente'}
                      </Badge>
                      <Badge className={AREA_COLORS[consultancy.technical_area]}>
                        {getAreaLabel(consultancy.technical_area)}
                      </Badge>
                      <Badge className={STATUS_BADGES[consultancy.status]}>
                        {consultancy.status === 'ativa' ? 'Ativa' : consultancy.status === 'encerrada' ? 'Encerrada' : 'Suspensa'}
                      </Badge>
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {getConsultancyReportCount(consultancy)} relatórios
                      </Badge>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-[var(--border-color)] pt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[var(--text-muted)]">Início</div>
                        <div className="text-[var(--text-primary)] font-medium">
                          {safeFormatDate(consultancy.start_date, 'dd MMM')}
                        </div>
                      </div>
                      {consultancy.value && (
                        <div>
                          <div className="text-[var(--text-muted)]">Valor</div>
                          <div className="text-[#22c55e] font-medium">
                            R$ {toNumber(consultancy.value).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>

                    {consultancy.next_return_date && (
                      <div className="p-2 bg-[#22c55e]/8 border border-[#22c55e]/20 rounded-lg">
                        <div className="flex items-center gap-2 text-xs">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#22c55e]" />
                          <span className="text-[#22c55e] font-medium">
                            Próx: {safeFormatDate(consultancy.next_return_date, 'dd MMM')}
                          </span>
                        </div>
                      </div>
                    )}

                    {consultancy.payment_date && (
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-xs">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-blue-600 font-medium">
                            Cobrança: {safeFormatDate(consultancy.payment_date, 'dd MMM')}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                      onClick={() => openProfile(consultancy)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Ver perfil e relatórios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
          } else {
            setIsOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingConsultancy ? 'Editar Consultoria' : 'Nova Consultoria'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client and Property */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value, property_id: '' })}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o cliente</option>
                  {clients.map((c) => (
                    <option key={c.id || c._id} value={String(c.id || c._id)}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Propriedade *</Label>
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  disabled={!formData.client_id}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                >
                  <option value="" disabled>Selecione a propriedade</option>
                  {clientProperties.map((p) => (
                    <option key={p.id || p._id} value={String(p.id || p._id)}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label>Escopo da Consultoria *</Label>
              <Input
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="Ex: Consultoria em Nutrição de Bovinos de Corte"
                required
                className="rounded-xl"
              />
            </div>

            {/* Type and Area */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o tipo</option>
                  <option value="pontual">Pontual</option>
                  <option value="recorrente">Recorrente</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Área Técnica *</Label>
                <select
                  value={formData.technical_area}
                  onChange={(e) => setFormData({ ...formData, technical_area: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione a área</option>
                  {TECHNICAL_AREAS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl h-12 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]",
                        !formData.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
                      {selectedStartDate ? (
                        format(selectedStartDate, "PPP", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]" align="start" side="bottom" sideOffset={8}>
                    <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1">
                      <Calendar
                        mode="single"
                        selected={selectedStartDate}
                        onSelect={(date) => setFormData({ ...formData, start_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                        initialFocus
                        classNames={{}}
                        locale={ptBR}
                        className="bg-[var(--bg-card)] text-[var(--text-primary)]"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data Término (Opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl h-12 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]",
                        !formData.end_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
                      {selectedEndDate ? (
                        format(selectedEndDate, "PPP", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]" align="start" side="bottom" sideOffset={8}>
                    <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1">
                      <Calendar
                        mode="single"
                        selected={selectedEndDate}
                        onSelect={(date) => setFormData({ ...formData, end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                        initialFocus
                        classNames={{}}
                        locale={ptBR}
                        className="bg-[var(--bg-card)] text-[var(--text-primary)]"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Recurring Settings */}
            {formData.type === 'recorrente' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="" disabled>Selecione</option>
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Próximo Retorno</Label>
                  <Input
                    type="date"
                    value={formData.next_return_date}
                    onChange={(e) => setFormData({ ...formData, next_return_date: e.target.value })}
                    className="rounded-xl h-12 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor do Serviço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Ex: 500,00"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Faturamento</Label>
                <select
                  value={formData.billing_type}
                  onChange={(e) => setFormData({ ...formData, billing_type: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o tipo</option>
                  <option value="unica">Pagamento Único</option>
                  <option value="mensal">Mensalidade</option>
                  <option value="por_visita">Por Visita</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dia de Cobrança</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl h-12 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]",
                      !formData.payment_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
                    {selectedPaymentDate ? (
                      format(selectedPaymentDate, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione o dia de cobrança</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]" align="start" side="bottom" sideOffset={8}>
                  <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1">
                    <Calendar
                      mode="single"
                      selected={selectedPaymentDate}
                      onSelect={(date) => setFormData({ ...formData, payment_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      initialFocus
                      classNames={{}}
                      locale={ptBR}
                      className="bg-[var(--bg-card)] text-[var(--text-primary)]"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Status da Consultoria</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="" disabled>Selecione o status</option>
                <option value="ativa">Ativa</option>
                <option value="encerrada">Encerrada</option>
                <option value="suspensa">Suspensa</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Notas Técnicas</Label>
              <Textarea
                value={formData.technical_notes}
                onChange={(e) => setFormData({ ...formData, technical_notes: e.target.value })}
                placeholder="Registre as conclusões e orientações técnicas..."
                rows={4}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações Internas</Label>
              <Textarea
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                placeholder="Notas administrativas ou observações gerais..."
                rows={2}
                className="rounded-xl"
              />
            </div>

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
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingConsultancy ? 'Salvar' : 'Cadastrar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isProfileOpen}
        onOpenChange={(open) => {
          if (!open) closeProfile();
          else setIsProfileOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              Perfil da Consultoria
            </DialogTitle>
          </DialogHeader>

          {profileConsultancy ? (
            <div className="space-y-5">
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg text-[var(--text-primary)]">
                    {getClientName(profileConsultancy.client_id)} — {getPropertyName(profileConsultancy.property_id)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={TYPE_BADGES[profileConsultancy.type]}>
                      {profileConsultancy.type === 'pontual' ? 'Pontual' : 'Recorrente'}
                    </Badge>
                    <Badge className={AREA_COLORS[profileConsultancy.technical_area]}>
                      {getAreaLabel(profileConsultancy.technical_area)}
                    </Badge>
                    <Badge className={STATUS_BADGES[profileConsultancy.status]}>
                      {profileConsultancy.status === 'ativa' ? 'Ativa' : profileConsultancy.status === 'encerrada' ? 'Encerrada' : 'Suspensa'}
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Escopo</div>
                      <div className="text-[var(--text-primary)] mt-1">{profileConsultancy.scope || '-'}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Período</div>
                      <div className="text-[var(--text-primary)] mt-1">
                        {safeFormatDate(profileConsultancy.start_date)}{profileConsultancy.end_date ? ` → ${safeFormatDate(profileConsultancy.end_date)}` : ''}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Dia de Cobrança</div>
                      <div className="text-[var(--text-primary)] mt-1">
                        {profileConsultancy.payment_date ? safeFormatDate(profileConsultancy.payment_date, 'dd/MM') : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--bg-tertiary)]">
                      <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Valor</div>
                      <div className="text-[var(--text-primary)] mt-1">
                        {profileConsultancy.value ? `R$ ${toNumber(profileConsultancy.value).toFixed(2)}` : '-'}
                      </div>
                    </div>
                  </div>

                  {profileConsultancy.technical_notes ? (
                    <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] text-sm">
                      <div className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Notas Técnicas</div>
                      <div className="text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{profileConsultancy.technical_notes}</div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-[var(--text-primary)]">Relatórios da consultoria</div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={closeProfile}
                  >
                    Fechar
                  </Button>
                </div>

                {getConsultancyReports(profileConsultancy).length === 0 ? (
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                    <CardContent className="py-10 text-center">
                      <FileText className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                      <div className="text-[var(--text-primary)] font-semibold">Nenhum relatório encontrado</div>
                      <div className="text-[var(--text-muted)] text-sm mt-1">
                        Relatórios são atendimentos do tipo consultoria com status finalizado/faturado no período.
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {getConsultancyReports(profileConsultancy).map((appt) => (
                      <Card key={appt.id || appt._id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                              {appt.consultoria_data?.service_type ? String(appt.consultoria_data.service_type).replaceAll('_', ' ') : 'Consultoria'}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              {safeFormatDate(appt.date, 'dd/MM/yyyy')} • {appt.status === 'faturado' ? 'Faturado' : 'Finalizado'}
                            </div>
                          </div>
                          <Button
                            type="button"
                            className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-semibold dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                            onClick={() => {
                              const appointmentId = appt.id || appt._id;
                              window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}`;
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Abrir
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
