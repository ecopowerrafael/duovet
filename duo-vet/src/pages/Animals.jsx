import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  GitBranch,
  Stethoscope,
  Filter,
  User,
  MapPin,
  RotateCw,
  Calendar as CalendarIcon,
  Eye,
  Clock,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import AnimalIcon from '../components/animals/AnimalIcon';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { differenceInMonths, differenceInYears, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { compareIds, deepClean } from '../lib/utils';
import { includesAnimalInAppointment, normalizeAppointmentForAnalysis } from '../lib/appointments';
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { cn } from "@/lib/utils";

const SPECIES = [
  { value: 'bovino', label: 'Bovino' },
  { value: 'equino', label: 'Equino' },
  { value: 'ovino', label: 'Ovino' },
  { value: 'caprino', label: 'Caprino' },
  { value: 'suino', label: 'Suíno' },
  { value: 'bubalino', label: 'Bubalino' },
  { value: 'outro', label: 'Outro' }
];

const STATUS = [
  { value: 'ativo', label: 'Ativo', color: 'bg-green-100 text-green-700' },
  { value: 'vendido', label: 'Vendido', color: 'bg-blue-100 text-blue-700' },
  { value: 'obito', label: 'Óbito', color: 'bg-gray-100 text-gray-700' },
  { value: 'abatido', label: 'Abatido', color: 'bg-red-100 text-red-700' }
];

export default function Animals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('animals');
  const [isOpen, setIsOpen] = useState(false);
  const [isLotOpen, setIsLotOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState(null);
  const [editingLot, setEditingLot] = useState(null);
  const [selectedLotProfile, setSelectedLotProfile] = useState(null);
  const [isLotProfileOpen, setIsLotProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('all');
  const [filterSex, setFilterSex] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    sex: '',
    birth_date: '',
    identification: '',
    color: '',
    weight: '',
    client_id: '',
    property_id: '',
    father_id: '',
    mother_id: '',
    father_name: '',
    father_breed: '',
    father_notes: '',
    mother_name: '',
    mother_breed: '',
    mother_notes: '',
    notes: '',
    status: 'ativo'
  });

  const [lotFormData, setLotFormData] = useState({
    name: '',
    client_id: '',
    property_id: '',
    species: '',
    quantity: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const [isPropertyDialogOpen, setIsPropertyDialogOpen] = useState(false);
  const [propertyFormData, setPropertyFormData] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    distance_km: '',
    notes: ''
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data) => {
      const payload = deepClean({
        name: data.name,
        address: data.address,
        client_id: data.client_id || null,
        details: {
          city: data.city,
          state: data.state,
          distance_km: data.distance_km,
          notes: data.notes
        },
        created_by: user?.email
      }) || {};
      return enqueueMutation('/api/properties', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await refetchProperties();
      if (res?.id) {
        setFormData(prev => ({ ...prev, property_id: res.id }));
      }
      toast.success(res?.queued ? 'Propriedade enfileirada para sincronização' : 'Propriedade cadastrada com sucesso!');
      setIsPropertyDialogOpen(false);
      setPropertyFormData({
        name: '',
        city: '',
        state: '',
        address: '',
        distance_km: '',
        notes: ''
      });
    },
    onError: () => {
      toast.error('Erro ao cadastrar propriedade');
    }
  });

  const handleOpenPropertyDialog = (e) => {
    e.preventDefault();
    setIsPropertyDialogOpen(true);
  };

  const { user } = useAuth();

  const { data: animals = [], isLoading, refetch, isRefetching } = useQuery({
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

  const { data: lots = [], refetch: refetchLots } = useQuery({
    queryKey: ['lots', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email || ''}`;
      const res = await offlineFetch(`/api/lots${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: allClients = [], refetch: refetchClients } = useQuery({
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

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
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

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetch(),
        refetchLots(),
        refetchClients(),
        refetchProperties(),
        refetchAppointments()
      ]),
      {
        loading: 'Atualizando dados...',
        success: 'Dados atualizados com sucesso!',
        error: 'Erro ao atualizar dados'
      }
    );
  };

  const createLotMutation = useMutation({
    mutationFn: (newLot) => enqueueMutation('/api/lots', { method: 'POST', body: deepClean({ ...newLot, created_by: user?.email }) || {} }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['lots'] });
      await refetchLots();
      setIsLotOpen(false);
      setLotFormData({ name: '', client_id: '', property_id: '', species: '', quantity: '', notes: '' });
      toast.success(res?.queued ? 'Lote enfileirado para sincronização' : 'Lote cadastrado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao cadastrar lote');
    }
  });

  const updateLotMutation = useMutation({
    mutationFn: (updatedLot) => enqueueMutation(`/api/lots/${updatedLot.id}`, { method: 'PUT', body: deepClean(updatedLot) || {} }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['lots'] });
      await refetchLots();
      setIsLotOpen(false);
      setEditingLot(null);
      setLotFormData({ name: '', client_id: '', property_id: '', species: '', quantity: '', notes: '' });
      toast.success(res?.queued ? 'Atualização enfileirada' : 'Lote atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar lote');
    }
  });

  const deleteLotMutation = useMutation({
    mutationFn: (id) => enqueueMutation(`/api/lots/${id}`, { method: 'DELETE' }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['lots'] });
      await refetchLots();
      toast.success(res?.queued ? 'Exclusão enfileirada' : 'Lote excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir lote');
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = deepClean(data) || {};
      return enqueueMutation('/api/animals', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAppointments()
      ]);
      
      toast.success(res?.queued ? 'Animal enfileirado para sincronização' : 'Animal criado com sucesso!');
      handleCloseDialog();
    },
    onError: (err) => {
      console.error('[Animals] Erro ao criar animal:', err);
      toast.error('Erro ao criar animal: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = deepClean(data) || {};
      return enqueueMutation(`/api/animals/${id}`, { method: 'PUT', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAppointments()
      ]);
      
      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Animal atualizado com sucesso!');
      setIsOpen(false);
    },
    onError: () => {
      console.error('[Animals] Erro ao atualizar animal:', err);
      toast.error('Erro ao atualizar animal: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return enqueueMutation(`/api/animals/${id}`, { method: 'DELETE' });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAppointments()
      ]);
      toast.success(res?.queued ? 'Remoção enfileirada para sincronização' : 'Animal removido com sucesso!');
    },
    onError: (err) => {
      console.error('[Animals] Erro ao remover animal:', err);
      toast.error('Erro ao remover animal: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === 'true') {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('duovet-dark') || 
                     document.body.classList.contains('duovet-dark') ||
                     getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() === '#16161a';
      setIsDarkMode(isDark);
    };
    
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const handleCloseLotDialog = () => {
    setIsLotOpen(false);
    setEditingLot(null);
    setLotFormData({
      name: '',
      client_id: '',
      property_id: '',
      species: '',
      quantity: '',
      notes: ''
    });
  };

  const handleEditLot = (lot) => {
    setEditingLot(lot);
    setLotFormData({
      name: lot.name || '',
      client_id: lot.client_id || '',
      property_id: lot.property_id || '',
      species: lot.species || '',
      quantity: lot.quantity?.toString() || '',
      notes: lot.notes || ''
    });
    setIsLotOpen(true);
  };

  const handleLotSubmit = (e) => {
    e.preventDefault();
    if (editingLot) {
      updateLotMutation.mutate({ ...lotFormData, id: editingLot.id });
    } else {
      createLotMutation.mutate(lotFormData);
    }
  };

  const handleDeleteLot = (id) => {
    if (confirm('Deseja realmente excluir este lote?')) {
      deleteLotMutation.mutate(id);
    }
  };

  const handleOpenLotProfile = (lot) => {
    setSelectedLotProfile(lot || null);
    setIsLotProfileOpen(true);
  };

  const filteredLots = (lots || []).filter(lot => {
    if (!lot) return false;
    const search = (searchTerm || '').trim().toLowerCase();
    const clientName = lot.client_id
      ? ((allClients || []).find((clientItem) => clientItem && compareIds(clientItem.id || clientItem._id, lot.client_id))?.name || '')
      : '';
    const propertyName = lot.property_id
      ? ((properties || []).find((propertyItem) => propertyItem && compareIds(propertyItem.id || propertyItem._id, lot.property_id))?.name || '')
      : '';
    const matchesSearch = !search
      ? true
      : (lot.name || '').toLowerCase().includes(search) ||
        clientName.toLowerCase().includes(search) ||
        propertyName.toLowerCase().includes(search);
    const matchesSpecies = filterSpecies === 'all' || lot.species === filterSpecies;
    const matchesClient = filterClient === 'all' || compareIds(lot.client_id, filterClient);
    return matchesSearch && matchesSpecies && matchesClient;
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingAnimal(null);
    setFormData({
      name: '',
      species: '',
      breed: '',
      sex: '',
      birth_date: '',
      identification: '',
      color: '',
      weight: '',
      client_id: '',
      property_id: '',
      father_id: '',
      mother_id: '',
      father_name: '',
      father_breed: '',
      father_notes: '',
      mother_name: '',
      mother_breed: '',
      mother_notes: '',
      notes: '',
      status: 'ativo'
    });
  };

  const handleEdit = (animal) => {
    setEditingAnimal(animal);
    setFormData({
      name: animal.name || '',
      species: animal.species || '',
      breed: animal.breed || '',
      sex: animal.sex || '',
      birth_date: animal.birth_date || '',
      identification: animal.identification || '',
      color: animal.color || '',
      weight: animal.weight?.toString() || '',
      client_id: animal.client_id || '',
      property_id: animal.property_id || '',
      father_id: animal.father_id || '',
      mother_id: animal.mother_id || '',
      father_name: animal.father_name || '',
      father_breed: animal.father_breed || '',
      father_notes: animal.father_notes || '',
      mother_name: animal.mother_name || '',
      mother_breed: animal.mother_breed || '',
      mother_notes: animal.mother_notes || '',
      notes: animal.notes || '',
      status: animal.status || 'ativo'
    });
    setIsOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && animals && animals.length > 0) {
      const animalToEdit = animals.find(a => compareIds(a.id || a._id, editId));
      if (animalToEdit && !isOpen && !editingAnimal) {
        handleEdit(animalToEdit);
        searchParams.delete('edit');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, animals, isOpen, editingAnimal, setSearchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.property_id) {
      toast.error('Selecione uma propriedade para o animal');
      return;
    }

    if (editingAnimal) {
      updateMutation.mutate({ id: editingAnimal.id, data: formData });
    } else {
      createMutation.mutate({ ...formData, created_by: user?.email });
    }
  };

  const getClientName = (clientId) => {
    if (!clientId) return '-';
    const client = (allClients || []).find(c => c && compareIds(c.id || c._id, clientId));
    return client?.name || '-';
  };

  const getAnimalName = (animalId) => {
    if (!animalId) return '-';
    const animal = (animals || []).find(a => a && compareIds(a.id || a._id, animalId));
    return animal?.name || '-';
  };

  const getStatusBadge = (status) => {
    const statusObj = STATUS.find(s => s.value === status);
    return statusObj || STATUS[0];
  };

  const getAnimalAge = (birthDate) => {
    if (!birthDate) return null;
    try {
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime())) return null;
      const years = differenceInYears(new Date(), birth);
      const months = differenceInMonths(new Date(), birth) % 12;
      if (years === 0) return `${months}m`;
      if (months === 0) return `${years}a`;
      return `${years}a ${months}m`;
    } catch (e) {
      return null;
    }
  };

  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);

  const getAnimalStats = (animalId) => {
    if (!animalId) return { appointmentCount: 0, lastAppointment: null };
    
    const animalAppointments = normalizedAppointments.filter((appointmentItem) => includesAnimalInAppointment(appointmentItem, animalId));

    const lastAppointment = [...animalAppointments].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })[0];

    return {
      appointmentCount: animalAppointments.length,
      lastAppointment
    };
  };

  const getLotAppointments = (lotId) => {
    if (!lotId) return [];
    return (appointments || []).filter((appointmentItem) => {
      if (!appointmentItem) return false;
      return compareIds(appointmentItem.lot_id, lotId);
    });
  };

  const getLotStats = (lotId) => {
    const lotAppointments = getLotAppointments(lotId);
    const totalRevenue = lotAppointments.reduce((sum, appointmentItem) => sum + (Number(appointmentItem?.total_amount) || 0), 0);
    const lastAppointment = [...lotAppointments].sort((a, b) => {
      const dateA = a?.date ? new Date(a.date).getTime() : 0;
      const dateB = b?.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })[0];
    return {
      appointmentCount: lotAppointments.length,
      totalRevenue,
      lastAppointment,
      timeline: [...lotAppointments].sort((a, b) => {
        const dateA = a?.date ? new Date(a.date).getTime() : 0;
        const dateB = b?.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      })
    };
  };

  const enrichedAnimals = (animals || []).map(animal => {
    if (!animal) return null;
    return {
      ...animal,
      age: getAnimalAge(animal.birth_date),
      ...getAnimalStats(animal.id)
    };
  }).filter(Boolean);

  const filteredAnimals = enrichedAnimals.filter(animal => {
    if (!animal) return false;
    
    const clientName = (allClients || []).find(c => c && compareIds(c.id || c._id, animal.client_id || animal.owner_id))?.name || '';
    
    const matchesSearch = 
      (animal.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (animal.identification || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (animal.breed || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSpecies = filterSpecies === 'all' || animal.species === filterSpecies;
    const matchesSex = filterSex === 'all' || animal.sex === filterSex;
    const matchesStatus = filterStatus === 'all' || animal.status === filterStatus;
    const matchesClient = filterClient === 'all' || compareIds(animal.client_id || animal.owner_id, filterClient);
    
    if (searchTerm) return matchesSearch;
    
    return matchesSearch && matchesSpecies && matchesSex && matchesStatus && matchesClient;
  }).sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'age') {
      const dateA = a.birth_date ? new Date(a.birth_date).getTime() : Infinity;
      const dateB = b.birth_date ? new Date(b.birth_date).getTime() : Infinity;
      return dateA - dateB;
    }
    if (sortBy === 'appointments') return (b.appointmentCount || 0) - (a.appointmentCount || 0);
    return 0;
  });

  const availableParents = (animals || []).filter(a => 
    a && a.species === formData.species && 
    !compareIds(a.id || a._id, editingAnimal?.id || editingAnimal?._id)
  );

  const availableFathers = availableParents.filter(a => a && a.sex === 'macho');
  const availableMothers = availableParents.filter(a => a && a.sex === 'femea');

  const clientProperties = (properties || []).filter(p => {
    if (!p || !formData.client_id) return false;
    return compareIds(p.client_id || p.clientId || p.id_client, formData.client_id);
  });
  const selectedLotStats = selectedLotProfile ? getLotStats(selectedLotProfile.id || selectedLotProfile._id) : null;
  const selectedLotClient = selectedLotProfile
    ? (allClients || []).find((clientItem) => clientItem && compareIds(clientItem.id || clientItem._id, selectedLotProfile.client_id))
    : null;
  const selectedLotProperty = selectedLotProfile
    ? (properties || []).find((propertyItem) => propertyItem && compareIds(propertyItem.id || propertyItem._id, selectedLotProfile.property_id))
    : null;

  return (
    <div className="space-y-6">
      {/* Header - iOS Mobile Friendly */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-3xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">Animais</h1>
          <p className="text-[var(--text-muted)] mt-0.5 text-sm font-medium">Gestão completa do rebanho</p>
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
            onClick={() => setIsOpen(true)} 
            className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-2xl font-semibold shadow-lg shadow-[var(--accent)]/25"
          >
            <Plus className="w-5 h-5" />
            Novo Animal
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('animals')}
          className={`pb-4 px-2 text-sm font-semibold transition-colors relative ${
            activeTab === 'animals' 
              ? 'text-[var(--accent)]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Animais Individuais
          {activeTab === 'animals' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('lots')}
          className={`pb-4 px-2 text-sm font-semibold transition-colors relative ${
            activeTab === 'lots' 
              ? 'text-[var(--accent)]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Lotes
          {activeTab === 'lots' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"
            />
          )}
        </button>
      </div>

      {activeTab === 'animals' ? (
        <React.Fragment>
          {/* Filters - Desktop */}
          <div className="hidden md:flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar por nome, identificação, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <select
          value={filterSpecies}
          onChange={(e) => setFilterSpecies(e.target.value)}
          className="w-40 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todas espécies</option>
          {SPECIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterSex}
          onChange={(e) => setFilterSex(e.target.value)}
          className="w-32 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos</option>
          <option value="macho">Macho</option>
          <option value="femea">Fêmea</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-32 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos</option>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-40 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="name">Nome</option>
          <option value="age">Idade</option>
          <option value="appointments">Atendimentos</option>
        </select>
      </div>

      {/* Mobile Filter Button */}
      <div className="md:hidden">
        <Button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          variant="outline"
          className="w-full h-12 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] gap-2 font-semibold"
        >
          <Filter className="w-5 h-5" />
          Filtrar
          {(filterSpecies !== 'all' || filterSex !== 'all' || filterStatus !== 'all') && (
            <Badge className="bg-[#22c55e] text-white ml-2 h-5 px-2 rounded-full">
              {[filterSpecies, filterSex, filterStatus].filter(f => f !== 'all').length}
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
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Espécie</Label>
                <select
                  value={filterSpecies}
                  onChange={(e) => setFilterSpecies(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todas espécies</option>
                  {SPECIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Sexo</Label>
                <select
                  value={filterSex}
                  onChange={(e) => setFilterSex(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos</option>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </div>
              <div>
                <Label className="text-sm mb-2 font-semibold">Status</Label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-12 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="all">Todos</option>
                  {STATUS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
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
                  <option value="age">Idade</option>
                  <option value="appointments">Atendimentos</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Animals Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredAnimals.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AnimalIcon species="bovino" className="w-12 h-12" white={false} />
          </div>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            {searchTerm ? 'Nenhum animal encontrado' : 'Nenhum animal cadastrado'}
          </p>
          <p className="text-[var(--text-muted)] mt-1">
            {searchTerm ? 'Tente ajustar os filtros' : 'Comece adicionando seu primeiro animal'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnimals.map((animal, index) => {
            const statusBadge = getStatusBadge(animal.status);
            const client = allClients.find(c => c && compareIds(c.id || c._id, animal.client_id || animal.owner_id));
            return (
              <motion.div
                key={animal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={createPageUrl('AnimalDetail') + `?id=${animal.id}`}>
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all cursor-pointer group h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {animal.photo_url ? (
                            <img src={animal.photo_url} alt={animal.name} className="w-12 h-12 rounded-xl object-cover" />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] rounded-xl flex items-center justify-center">
                              <AnimalIcon species={animal.species} className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                              {animal.name}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)]">
                              {SPECIES.find(s => s.value === animal.species)?.label}
                              {animal.age && ` • ${animal.age}`}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                            <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleEdit(animal); }} className="cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl('NewAppointment') + `?animal=${animal.id}`} className="cursor-pointer">
                                <Stethoscope className="w-4 h-4 mr-2" />
                                Novo Atendimento
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { e.preventDefault(); if (confirm('Deseja realmente excluir este animal?')) deleteMutation.mutate(animal.id); }}
                              className="text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {animal.identification && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-[var(--text-muted)]">ID:</span>
                          <span className="text-xs font-mono bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--text-primary)]">
                            {animal.identification}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="text-center py-2.5 bg-[var(--bg-tertiary)] rounded-2xl">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Stethoscope className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                            <span className="font-bold text-[var(--text-primary)]">{animal.appointmentCount}</span>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] font-semibold">Atend.</span>
                        </div>
                        <div className="text-center py-2.5 bg-[var(--bg-tertiary)] rounded-2xl">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <User className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                            <span className="font-bold text-[var(--text-primary)] text-xs truncate px-1">
                              {client?.name || 'Não encontrado'}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] font-semibold">Dono</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] flex-wrap gap-2">
                        <Badge className={`${statusBadge.color} text-xs font-semibold px-3 py-1 rounded-lg`}>
                          {statusBadge.label}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {animal.sex && (
                            <span className={`text-base font-bold ${
                              animal.sex === 'macho' ? 'text-blue-500' : 'text-pink-500'
                            }`}>
                              {animal.sex === 'macho' ? '♂' : '♀'}
                            </span>
                          )}
                          {(animal.father_id || animal.mother_id || animal.father_name || animal.mother_name) && (
                            <GitBranch className="w-4 h-4 text-[var(--accent)]" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </React.Fragment>
      ) : (
        <div className="space-y-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <Input
              placeholder="Buscar lote por nome, cliente ou propriedade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="group hover:border-[var(--accent)] transition-all cursor-pointer border-dashed border-2 flex items-center justify-center min-h-[200px] bg-[var(--bg-card)] hover:bg-[var(--accent)]/5"
            onClick={() => { setEditingLot(null); setLotFormData({ name: '', client_id: '', property_id: '', species: '', quantity: '', notes: '' }); setIsLotOpen(true); }}
          >
            <div className="text-center">
              <Plus className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" />
              <p className="font-semibold text-[var(--text-primary)]">Adicionar Novo Lote</p>
            </div>
          </Card>
          
          {filteredLots.map((lot) => {
            const client = allClients.find(c => c && compareIds(c.id || c._id, lot.client_id));
            const property = properties.find(p => p && compareIds(p.id || p._id, lot.property_id));
            return (
              <motion.div
                key={lot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                layout
              >
                <Card className="group hover:border-[var(--accent)] transition-all border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] rounded-xl flex items-center justify-center">
                            <AnimalIcon species={lot.species} isLot={true} className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)]">{lot.name}</h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            {SPECIES.find(s => s.value === lot.species)?.label} • {lot.quantity} cabeças
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleEditLot(lot)} className="cursor-pointer">
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl('NewAppointment') + `?lot=${lot.id}`} className="cursor-pointer">
                              <Stethoscope className="w-4 h-4 mr-2" />
                              Atendimento de Lote
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteLot(lot.id)}
                            className="text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <User className="w-4 h-4" />
                        <span>Cliente: {client?.name || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <MapPin className="w-4 h-4" />
                        <span>Propriedade: {property?.name || '-'}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenLotProfile(lot)}
                        className="w-full rounded-xl border-[var(--border-color)] text-[var(--text-primary)] gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Ver perfil do lote
                      </Button>
                    </div>

                    {lot.notes && (
                      <p className="text-xs text-[var(--text-muted)] italic border-t border-[var(--border-color)] pt-3">
                        {lot.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          </div>
        </div>
      )}

      <Dialog open={isLotProfileOpen} onOpenChange={setIsLotProfileOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {selectedLotProfile?.name || 'Perfil do Lote'}
            </DialogTitle>
            <DialogDescription>
              Linha do tempo e indicadores dos atendimentos vinculados ao lote.
            </DialogDescription>
          </DialogHeader>

          {selectedLotProfile && selectedLotStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Atendimentos</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{selectedLotStats.appointmentCount}</p>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Último Atendimento</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedLotStats.lastAppointment?.date
                      ? format(new Date(selectedLotStats.lastAppointment.date), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Sem registros'}
                  </p>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Receita Total</p>
                  <p className="text-lg font-bold text-emerald-500">R$ {selectedLotStats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Cliente</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedLotClient?.name || '-'}</p>
                </div>
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Propriedade</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedLotProperty?.name || '-'}</p>
                </div>
              </div>

              <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-[var(--accent)]" />
                  <h4 className="font-semibold text-[var(--text-primary)]">Linha do Tempo de Atendimentos</h4>
                </div>

                {selectedLotStats.timeline.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)]">Nenhum atendimento registrado para este lote</div>
                ) : (
                  <div className="space-y-3">
                    {selectedLotStats.timeline.map((appointmentItem) => (
                      <Link
                        key={appointmentItem.id || appointmentItem._id}
                        to={createPageUrl('AppointmentDetail') + `?id=${appointmentItem.id || appointmentItem._id}`}
                        onClick={() => setIsLotProfileOpen(false)}
                        className="block"
                      >
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent)] transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-[var(--text-primary)] truncate capitalize">
                                {appointmentItem.type || 'Atendimento'}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  {appointmentItem.date ? format(new Date(appointmentItem.date), 'dd/MM/yyyy', { locale: ptBR }) : 'Data não informada'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  R$ {(Number(appointmentItem.total_amount) || 0).toFixed(2)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Stethoscope className="w-3 h-3" />
                                  {appointmentItem.status || 'registrado'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lot Dialog */}
      <Dialog open={isLotOpen} onOpenChange={handleCloseLotDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingLot ? 'Editar Lote' : 'Novo Lote'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {editingLot ? 'editar' : 'cadastrar'} um lote.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLotSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Nome do Lote *</Label>
                <Input
                  value={lotFormData.name}
                  onChange={(e) => setLotFormData({ ...lotFormData, name: e.target.value })}
                  placeholder="Ex: Lote Engorda 2024"
                  required
                />
              </div>
              <div>
                <Label>Espécie *</Label>
                <select
                  value={lotFormData.species}
                  onChange={(e) => setLotFormData({ ...lotFormData, species: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione a espécie</option>
                  {SPECIES.map((species) => (
                    <option key={species.value} value={species.value}>
                      {species.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Quantidade de Animais</Label>
                <Input
                  type="number"
                  value={lotFormData.quantity}
                  onChange={(e) => setLotFormData({ ...lotFormData, quantity: e.target.value })}
                  placeholder="Ex: 50"
                />
              </div>
              <div>
                <Label>Cliente *</Label>
                <select
                  value={lotFormData.client_id}
                  onChange={(e) => setLotFormData({ ...lotFormData, client_id: e.target.value, property_id: '' })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione o cliente</option>
                  {allClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Propriedade *</Label>
                <select
                  value={lotFormData.property_id}
                  onChange={(e) => setLotFormData({ ...lotFormData, property_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione a propriedade</option>
                  {properties.filter(p => {
                    if (!lotFormData.client_id) return false;
                    return compareIds(p.client_id || p.clientId || p.id_client, lotFormData.client_id);
                  }).map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Observações</Label>
                <textarea
                  value={lotFormData.notes}
                  onChange={(e) => setLotFormData({ ...lotFormData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[100px]"
                  placeholder="Notas adicionais sobre o lote..."
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleCloseLotDialog} className="flex-1 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black shadow-lg shadow-[#1a4d2e]/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90">
                {editingLot ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Animal Dialog */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingAnimal ? 'Editar Animal' : 'Novo Animal'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para {editingAnimal ? 'editar' : 'cadastrar'} um animal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nome/Identificação *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do animal"
                  required
                />
              </div>
              <div>
                <Label>Espécie *</Label>
                <select
                  value={formData.species}
                  onChange={(e) => setFormData({ ...formData, species: e.target.value, father_id: '', mother_id: '' })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione a espécie</option>
                  {SPECIES.map((species) => (
                    <option key={species.value} value={species.value}>
                      {species.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Raça</Label>
                <Input
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  placeholder="Raça do animal"
                />
              </div>
              <div>
                <Label>Sexo</Label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione o sexo</option>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full h-10 px-3 flex items-center rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div>
                <Label>Número de Identificação</Label>
                <Input
                  value={formData.identification}
                  onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
                  placeholder="Brinco, chip, etc."
                />
              </div>
              <div>
                <Label>Pelagem/Cor</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="Cor do animal"
                />
              </div>
              <div>
                <Label>Peso (kg)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formData.weight}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setFormData({ ...formData, weight: val });
                  }}
                  placeholder="Peso em kg"
                />
              </div>
              <div>
                <Label>Proprietário *</Label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value, property_id: '' })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                >
                  <option value="" disabled>Selecione o proprietário</option>
                  {allClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Propriedade *</Label>
                {formData.client_id ? (
                  clientProperties.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={formData.property_id}
                        onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        required
                      >
                        <option value="" disabled>Selecione a propriedade</option>
                        {clientProperties.map((property) => (
                          <option key={property.id} value={property.id}>
                            {property.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleOpenPropertyDialog}
                        title="Adicionar nova propriedade"
                        className="flex-shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                      O cliente selecionado não possui propriedades cadastradas. 
                      <button type="button" onClick={handleOpenPropertyDialog} className="font-semibold underline ml-1 text-[var(--accent)] hover:text-[var(--accent-hover)]">
                        Adicionar propriedade
                      </button>
                    </div>
                  )
                ) : (
                  <select
                    disabled
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  >
                    <option value="" disabled>Selecione o proprietário primeiro</option>
                  </select>
                )}
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Status do animal</option>
                  {STATUS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Genealogy Section */}
            <div className="border-t pt-4 border-[var(--border-color)]">
              <h4 className="font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[var(--accent)]" />
                Dados Genealógicos
              </h4>
              
              {/* Father Section */}
              <div className="mb-6 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)]">
                <h5 className="font-medium text-[var(--text-primary)] mb-3">
                  Pai
                </h5>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Nome do Pai</Label>
                    <Input
                      value={formData.father_name}
                      onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                      placeholder="Nome do pai (texto livre)"
                      className="bg-[var(--bg-card)]"
                      list="fathers-list"
                    />
                    {formData.species && availableFathers.length > 0 && (
                      <datalist id="fathers-list">
                        {availableFathers.map((animal) => (
                          <option key={animal.id} value={animal.name} />
                        ))}
                      </datalist>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Digite o nome livremente ou selecione um animal cadastrado
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Raça do Pai</Label>
                      <Input
                        value={formData.father_breed}
                        onChange={(e) => setFormData({ ...formData, father_breed: e.target.value })}
                        placeholder="Raça (opcional)"
                        className="bg-[var(--bg-card)]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Observações</Label>
                      <Input
                        value={formData.father_notes}
                        onChange={(e) => setFormData({ ...formData, father_notes: e.target.value })}
                        placeholder="Observações (opcional)"
                        className="bg-[var(--bg-card)]"
                      />
                    </div>
                  </div>
                  {formData.species && availableFathers.length > 0 && (
                    <div>
                      <Label className="text-sm">Vincular a animal cadastrado (opcional)</Label>
                      <select
                        value={formData.father_id || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const selectedFather = availableFathers.find(a => compareIds(a.id || a._id, value));
                          setFormData({ 
                            ...formData, 
                            father_id: value,
                            father_name: selectedFather?.name || formData.father_name,
                            father_breed: selectedFather?.breed || formData.father_breed
                          });
                        }}
                        className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="">Selecione se cadastrado</option>
                        <option value="">Nenhum vínculo</option>
                        {availableFathers.map((animal) => (
                          <option key={animal.id} value={animal.id}>
                            {animal.name} {animal.identification && `(${animal.identification})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Mother Section */}
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-color)]">
                <h5 className="font-medium text-[var(--text-primary)] mb-3">
                  Mãe
                </h5>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Nome da Mãe</Label>
                    <Input
                      value={formData.mother_name}
                      onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                      placeholder="Nome da mãe (texto livre)"
                      className="bg-[var(--bg-card)]"
                      list="mothers-list"
                    />
                    {formData.species && availableMothers.length > 0 && (
                      <datalist id="mothers-list">
                        {availableMothers.map((animal) => (
                          <option key={animal.id} value={animal.name} />
                        ))}
                      </datalist>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Digite o nome livremente ou selecione um animal cadastrado
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Raça da Mãe</Label>
                      <Input
                        value={formData.mother_breed}
                        onChange={(e) => setFormData({ ...formData, mother_breed: e.target.value })}
                        placeholder="Raça (opcional)"
                        className="bg-[var(--bg-card)]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Observações</Label>
                      <Input
                        value={formData.mother_notes}
                        onChange={(e) => setFormData({ ...formData, mother_notes: e.target.value })}
                        placeholder="Observações (opcional)"
                        className="bg-[var(--bg-card)]"
                      />
                    </div>
                  </div>
                  {formData.species && availableMothers.length > 0 && (
                    <div>
                      <Label className="text-sm">Vincular a animal cadastrado (opcional)</Label>
                      <select
                        value={formData.mother_id || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const selectedMother = availableMothers.find(a => compareIds(a.id || a._id, value));
                          setFormData({ 
                            ...formData, 
                            mother_id: value,
                            mother_name: selectedMother?.name || formData.mother_name,
                            mother_breed: selectedMother?.breed || formData.mother_breed
                          });
                        }}
                        className="w-full h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="">Selecione se cadastrado</option>
                        <option value="">Nenhum vínculo</option>
                        {availableMothers.map((animal) => (
                          <option key={animal.id} value={animal.id}>
                            {animal.name} {animal.identification && `(${animal.identification})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o animal..."
                rows={3}
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
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingAnimal ? 'Salvar' : 'Cadastrar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isPropertyDialogOpen} onOpenChange={setIsPropertyDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Propriedade</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para cadastrar uma nova propriedade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Propriedade *</Label>
              <Input
                value={propertyFormData.name}
                onChange={(e) => setPropertyFormData({ ...propertyFormData, name: e.target.value })}
                placeholder="Ex: Fazenda Santa Maria"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Município</Label>
                <Input
                  value={propertyFormData.city}
                  onChange={(e) => setPropertyFormData({ ...propertyFormData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={propertyFormData.state}
                  onChange={(e) => setPropertyFormData({ ...propertyFormData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={propertyFormData.address}
                onChange={(e) => setPropertyFormData({ ...propertyFormData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>
            <div>
              <Label>Distância (km)</Label>
              <Input
                type="number"
                step="0.1"
                value={propertyFormData.distance_km}
                onChange={(e) => setPropertyFormData({ ...propertyFormData, distance_km: e.target.value })}
                placeholder="0.0"
              />
            </div>
            <Button 
              onClick={() => createPropertyMutation.mutate(propertyFormData)} 
              disabled={!propertyFormData.name || createPropertyMutation.isPending}
              className="w-full bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
            >
              {createPropertyMutation.isPending ? 'Salvando...' : 'Cadastrar Propriedade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
