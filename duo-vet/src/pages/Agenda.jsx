import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar as CalendarIcon,
  Grid3x3,
  List,
  RefreshCw,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import WeekViewDay from '../components/agenda/WeekViewDay';
import AgendaFilters from '../components/agenda/AgendaFilters';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { offlineFetch, enqueueMutation, getGoogleCalendarAuthUrl } from '../lib/offline';
import { compareIds } from '../lib/utils';



const APPOINTMENT_TYPES = [
  { value: 'clinico', label: 'Clínico' },
  { value: 'reprodutivo', label: 'Reprodutivo' },
  { value: 'cirurgico', label: 'Cirúrgico' },
  { value: 'sanitario', label: 'Sanitário' },
  { value: 'preventivo', label: 'Preventivo' }
];

const EVENT_TYPES = {
  atendimento: { label: 'Atendimento', color: 'bg-[#22c55e]' },
  preventivo: { label: 'Preventivo', color: 'bg-blue-500' },
  consultoria: { label: 'Consultoria', color: 'bg-purple-500' },
  retorno: { label: 'Retorno', color: 'bg-amber-500' },
  pessoal: { label: 'Pessoal', color: 'bg-gray-500' },
  bloqueio: { label: 'Bloqueio', color: 'bg-red-500' }
};

const STATUS_CONFIG = {
  agendado: { label: 'Agendado' },
  confirmado: { label: 'Confirmado' },
  em_atendimento: { label: 'Em Atendimento' },
  finalizado: { label: 'Finalizado' },
  cancelado: { label: 'Cancelado' }
};

export default function Agenda() {
  const navigate = useNavigate();
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const lastIsMobileRef = React.useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'atendimento',
    start_datetime: '',
    end_datetime: '',
    client_id: '',
    property_id: '',
    animal_ids: [],
    appointment_type: '',
    location: '',
    notes: '',
    status: 'agendado',
    reminder_1day: false,
    reminder_1hour: false,
    reminder_15min: false,
    appointment_id: null
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: userData } = useQuery({
    queryKey: ['userData', user?.id],
    queryFn: async () => offlineFetch(`/api/users/${user.id}`),
    enabled: !!user?.id
  });

  const isGoogleConnected = !!userData?.google_refresh_token;

  const handleConnectGoogle = () => {
    window.location.href = getGoogleCalendarAuthUrl();
  };

  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const sort = isAdmin ? '?sort=-start_datetime' : '&sort=-start_datetime';
      return offlineFetch(`/api/events${query}${sort}`);
    },
    enabled: !!user?.email
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const res = await offlineFetch(`/api/clients${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: properties = [], refetch: refetchProperties } = useQuery({
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

  const { data: animals = [], refetch: refetchAnimals } = useQuery({
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

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchEvents(),
        refetchClients(),
        refetchProperties(),
        refetchAnimals()
      ]),
      {
        loading: 'Sincronizando agenda...',
        success: 'Agenda atualizada!',
        error: 'Erro ao sincronizar dados'
      }
    );
  };

  const lastCreateRef = React.useRef(null);
  const lastUpdateRef = React.useRef(null);
  const lastDeleteRef = React.useRef(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = lastCreateRef.current;
      return enqueueMutation('/api/events', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      
      await Promise.all([
        refetchEvents(),
        refetchClients(),
        refetchProperties(),
        refetchAnimals()
      ]);

      toast.success(res?.queued ? 'Evento enfileirado para sincronização' : 'Evento criado com sucesso!');
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = lastUpdateRef.current || {};
      return enqueueMutation(`/api/events/${payload.id}`, { method: 'PUT', body: payload.data });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      
      await Promise.all([
        refetchEvents(),
        refetchClients(),
        refetchProperties(),
        refetchAnimals()
      ]);

      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Evento atualizado com sucesso!');
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const id = lastDeleteRef.current;
      return enqueueMutation(`/api/events/${id}`, { method: 'DELETE' });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      
      await Promise.all([
        refetchEvents(),
        refetchClients(),
        refetchProperties(),
        refetchAnimals()
      ]);

      toast.success(res?.queued ? 'Remoção enfileirada para sincronização' : 'Evento removido com sucesso!');
    }
  });

  const syncEventMutation = useMutation({
    mutationFn: (event_id) => enqueueMutation(`/api/google-calendar/sync/${event_id}`, { method: 'POST' }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await refetchEvents();
      if (response?.queued) {
        toast.success('Sincronização enfileirada para envio quando houver conexão');
        return;
      }
      if (response?.skipped) {
        toast.error('Conecte sua conta Google para sincronizar');
        return;
      }
      toast.success('Evento sincronizado com Google Calendar!');
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar evento: ' + error.message);
    }
  });

  const syncAllEventsMutation = useMutation({
    mutationFn: () => enqueueMutation('/api/google-calendar/sync-all', { method: 'POST' }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await refetchEvents();
      if (response?.queued) {
        toast.success('Sincronização em lote enfileirada para envio quando houver conexão');
        return;
      }
      const results = response.results;
      if (results) {
        toast.success(`${results.synced} eventos sincronizados com sucesso!`);
        if (results.failed > 0) {
          toast.error(`${results.failed} eventos falharam na sincronização`);
        }
      } else {
        toast.success('Sincronização concluída!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar eventos: ' + error.message);
    }
  });

  const unsyncEventMutation = useMutation({
    mutationFn: (event_id) => enqueueMutation(`/api/google-calendar/sync/${event_id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await refetchEvents();
      toast.success('Sincronização removida do Google Calendar!');
    },
    onError: (error) => {
      toast.error('Erro ao remover sincronização: ' + error.message);
    }
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    setSelectedDate(null);
    setFormData({
      title: '',
      event_type: 'atendimento',
      start_datetime: '',
      end_datetime: '',
      client_id: '',
      property_id: '',
      animal_ids: [],
      appointment_type: '',
      location: '',
      notes: '',
      status: 'agendado',
      reminder_1day: false,
      reminder_1hour: false,
      reminder_15min: false,
      appointment_id: null
    });
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      event_type: event.event_type || 'atendimento',
      start_datetime: event.start_datetime || '',
      end_datetime: event.end_datetime || '',
      client_id: event.client_id || '',
      property_id: event.property_id || '',
      animal_ids: event.animal_ids || [],
      appointment_type: event.appointment_type || '',
      location: event.location || '',
      notes: event.notes || '',
      status: event.status || 'agendado',
      reminder_1day: event.reminder_1day || false,
      reminder_1hour: event.reminder_1hour || false,
      reminder_15min: event.reminder_15min || false,
      appointment_id: event.appointment_id || null
    });
    setIsDialogOpen(true);
  };

  const handleNewEvent = (date = null) => {
    if (date) {
      try {
        const startDate = new Date(date);
        if (isNaN(startDate.getTime())) throw new Error('Invalid date');
        
        startDate.setHours(8, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(9, 0, 0, 0);
        
        setFormData({
          ...formData,
          start_datetime: startDate.toISOString().slice(0, 16),
          end_datetime: endDate.toISOString().slice(0, 16)
        });
        setSelectedDate(date);
      } catch (err) {
        console.error('Error setting new event date:', err);
        toast.error('Data inválida selecionada');
        return;
      }
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEvent) {
      lastUpdateRef.current = { id: editingEvent.id, data: formData };
      updateMutation.mutate();
    } else {
      lastCreateRef.current = { ...formData, created_by: user?.email };
      createMutation.mutate();
    }
  };

  const getDaysInView = () => {
    if (view === 'day') {
      return [currentDate];
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { locale: ptBR });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startWeek = startOfWeek(start, { locale: ptBR });
      const endWeek = endOfWeek(end, { locale: ptBR });
      const days = [];
      let day = startWeek;
      while (day <= endWeek) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    }
  };

  const getEventsForDay = (day) => {
    if (!day) return [];
    
    try {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      if (isNaN(dayStart.getTime())) return [];

      return (events || []).filter(event => {
        if (!event || !event.start_datetime) return false;
        try {
          const eventDate = parseISO(event.start_datetime);
          if (isNaN(eventDate.getTime())) return false;
          
          const matchesDay = eventDate >= dayStart && eventDate <= dayEnd;
          const matchesType = filterType === 'all' || event.event_type === filterType;
          
          const eventTitle = (event.title || '').toLowerCase();
          const searchLower = (searchTerm || '').toLowerCase();
          
          const clientName = (clients || []).find(c => 
            c && compareIds(c.id || c._id, event.client_id)
          )?.name?.toLowerCase() || '';
          
          const matchesSearch = eventTitle.includes(searchLower) || clientName.includes(searchLower);
          
          return matchesDay && matchesType && matchesSearch;
        } catch (error) {
          return false;
        }
      }).sort((a, b) => {
        const dateA = a.start_datetime ? new Date(a.start_datetime).getTime() : 0;
        const dateB = b.start_datetime ? new Date(b.start_datetime).getTime() : 0;
        return dateA - dateB;
      });
    } catch (err) {
      console.error('Error in getEventsForDay:', err);
      return [];
    }
  };

  const navigateDate = (direction) => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, direction));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, direction));
    } else {
      setCurrentDate(addMonths(currentDate, direction));
    }
  };

  // Auto-switch to day view on mobile
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      const previousMobile = lastIsMobileRef.current;
      lastIsMobileRef.current = mobile;
      if (previousMobile === null) {
        if (mobile && view === 'month') setView('day');
        return;
      }
      if (!previousMobile && mobile && view === 'week') {
        setView('day');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  const days = getDaysInView();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Agenda</h1>
          <p className="text-[var(--text-muted)] mt-1">
            {view === 'day' && format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {view === 'week' && `${format(days[0], "d 'de' MMM", { locale: ptBR })} - ${format(days[6], "d 'de' MMM 'de' yyyy", { locale: ptBR })}`}
            {view === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            className="rounded-xl gap-2 h-12 px-4 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </Button>
          {!isGoogleConnected ? (
            <Button 
              onClick={handleConnectGoogle}
              className="bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl gap-2 h-12 px-6 border border-gray-300 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              Conectar Google Agenda
            </Button>
          ) : (
            <Button 
              onClick={() => syncAllEventsMutation.mutate()}
              disabled={syncAllEventsMutation.isPending}
              variant="outline"
              className="rounded-xl gap-2 h-12 px-4 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
            >
              {syncAllEventsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 text-green-500" />
              )}
              Sincronizar Todos
            </Button>
          )}
          <Button 
            onClick={() => handleNewEvent()}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold rounded-xl gap-2 h-12 px-6 shadow-lg shadow-[#22c55e]/25"
          >
            <Plus className="w-5 h-5" />
            Novo Evento
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        {/* View Switcher - Hidden on mobile for week view */}
        <div className="w-full lg:w-auto overflow-x-auto">
          <div className="flex gap-2 bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-color)] w-fit lg:w-auto">
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
              className={view === 'day' 
                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-md' 
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md'}
            >
              <List className="w-4 h-4" />
              {!isMobile && <span className="ml-2">Dia</span>}
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className={view === 'week' 
                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-md' 
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md'}
            >
              <CalendarIcon className="w-4 h-4" />
              {!isMobile && <span className="ml-2">Semana</span>}
            </Button>
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className={view === 'month' 
                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-md' 
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md'}
            >
              <Grid3x3 className="w-4 h-4" />
              {!isMobile && <span className="ml-2">Mês</span>}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(-1)} 
            className="rounded-full hover:bg-[var(--bg-tertiary)]"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-primary)]" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-lg font-medium px-4 h-9 text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(1)}
            className="rounded-full hover:bg-[var(--bg-tertiary)]"
          >
            <ChevronRight className="w-5 h-5 text-[var(--text-primary)]" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 ml-auto">
          <AgendaFilters 
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Calendar Grid */}
      {eventsLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          {view === 'month' ? (
            <>
              {/* Month Header */}
              <div className="grid grid-cols-7 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-semibold text-[var(--text-primary)]">
                    {day}
                  </div>
                ))}
              </div>
              {/* Month Grid */}
              <div className="grid grid-cols-7">
                {days.map((day, index) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] p-2 border-r border-b border-[var(--border-color)] ${
                        !isCurrentMonth ? 'bg-[var(--bg-tertiary)] opacity-50' : ''
                      } ${isToday ? 'bg-[var(--accent-bg)]' : ''}`}
                      onClick={() => handleNewEvent(day)}
                    >
                      <div className={`text-sm font-semibold mb-1 ${
                        isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const typeConfig = EVENT_TYPES[event.event_type];
                          const statusConfig = STATUS_CONFIG[event.status || 'agendado'];
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(event);
                              }}
                              className={`${typeConfig?.color || 'bg-[var(--accent)]'} bg-opacity-10 text-[var(--accent)] text-[10px] md:text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity line-clamp-1 flex items-center gap-1 border-l-2 ${typeConfig?.color?.replace('bg-', 'border-') || 'border-[var(--accent)]'}`}
                            >
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                event.status === 'finalizado' ? 'bg-gray-400' :
                                event.status === 'cancelado' ? 'bg-red-500' :
                                event.status === 'em_atendimento' ? 'bg-amber-500' :
                                event.status === 'confirmado' ? 'bg-green-500' :
                                'bg-blue-500'
                              }`} title={statusConfig.label} />
                              <span className="truncate">{event.title}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-[var(--text-muted)]">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Day/Week Header */}
              <div className={isMobile && view === 'week' ? 'overflow-x-auto' : ''}>
                <div className={`grid ${view === 'week' ? 'grid-cols-7 min-w-[980px]' : 'grid-cols-1'} bg-[var(--bg-card)] border-b border-[var(--border-color)]`}>
                  {days.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div key={day.toString()} className={`p-3 md:p-4 text-center border-r border-[var(--border-color)] last:border-r-0 ${
                        isToday ? 'bg-[var(--accent)]/5' : ''
                      }`}>
                        <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                          {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div className={`text-2xl font-bold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`grid ${view === 'week' ? 'grid-cols-7 min-w-[980px]' : 'grid-cols-1'} min-h-[500px] md:min-h-[600px] bg-[var(--bg-primary)]`}>
                  {days.map((day) => {
                    const dayEvents = getEventsForDay(day);

                    return (
                      <WeekViewDay
                        key={day.toString()}
                        day={day}
                        events={dayEvents}
                        isToday={isSameDay(day, new Date())}
                        client={clients.find(c => compareIds(c.id || c._id, dayEvents[0]?.client_id))}
                        property={properties.find(p => compareIds(p.id || p._id, dayEvents[0]?.property_id))}
                        onNewEvent={handleNewEvent}
                        onEdit={handleEdit}
                        onSync={(eventId, isSynced) => {
                          if (isSynced) {
                            unsyncEventMutation.mutate(eventId);
                          } else {
                            syncEventMutation.mutate(eventId);
                          }
                        }}
                        syncPending={syncEventMutation.isPending || unsyncEventMutation.isPending}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-auto"
          style={{ maxHeight: 'min(90vh, calc(100vh - 80px))' }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingEvent ? 'Editar Evento' : 'Novo Evento'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Atendimento Reprodutivo"
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Evento *</Label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {Object.entries(EVENT_TYPES).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <DateTimePicker
                label="Data/Hora Início *"
                date={formData.start_datetime}
                setDate={(date) => setFormData({ ...formData, start_datetime: date })}
              />
              <DateTimePicker
                label="Data/Hora Término *"
                date={formData.end_datetime}
                setDate={(date) => setFormData({ ...formData, end_datetime: date })}
              />
            </div>

            {formData.event_type === 'atendimento' && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">Selecione</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Propriedade</Label>
                    <select
                      value={formData.property_id}
                      onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                      className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">Selecione</option>
                      {properties.filter(p => !formData.client_id || compareIds(p.client_id, formData.client_id)).map((property) => (
                        <option key={property.id} value={property.id}>{property.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Atendimento</Label>
                  <select
                    value={formData.appointment_type}
                    onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                    className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="" disabled>Selecione</option>
                    {APPOINTMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Local</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Fazenda São João"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o evento..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
              <Label>Lembretes</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">1 dia antes</span>
                <input
                  type="checkbox"
                  checked={formData.reminder_1day}
                  onChange={(e) => setFormData({ ...formData, reminder_1day: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">1 hora antes</span>
                <input
                  type="checkbox"
                  checked={formData.reminder_1hour}
                  onChange={(e) => setFormData({ ...formData, reminder_1hour: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">15 minutos antes</span>
                <input
                  type="checkbox"
                  checked={formData.reminder_15min}
                  onChange={(e) => setFormData({ ...formData, reminder_15min: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              {editingEvent && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      lastDeleteRef.current = editingEvent.id;
                      deleteMutation.mutate();
                      handleCloseDialog();
                    }}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                  {formData.appointment_id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigate(`/AppointmentDetail?id=${formData.appointment_id}`);
                      }}
                      className="rounded-xl gap-2 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Atendimento
                    </Button>
                  )}
                  {!editingEvent.is_readonly && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (editingEvent.is_synced) {
                          unsyncEventMutation.mutate(editingEvent.id);
                        } else {
                          syncEventMutation.mutate(editingEvent.id);
                        }
                        handleCloseDialog();
                      }}
                      disabled={syncEventMutation.isPending || unsyncEventMutation.isPending}
                      className="rounded-xl gap-2 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
                    >
                      {editingEvent.is_synced ? (
                        <>
                          <Cloud className="w-4 h-4 text-red-500" />
                          Remover Sync
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4 text-green-500" />
                          Sincronizar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-semibold shadow-lg shadow-[#22c55e]/25 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingEvent ? 'Salvar' : 'Criar')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
