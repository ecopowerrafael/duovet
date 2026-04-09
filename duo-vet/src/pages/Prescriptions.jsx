import React, { useState, useEffect, useMemo, useRef } from 'react';
// Base44 removido: substituído por mocks/local logic
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  FileText,
  Download,
  Send,
  Eye,
  Calendar,
  Calendar as CalendarIcon,
  Filter,
  PawPrint,
  Pill,
  Stethoscope,
  Plus,
  RotateCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const safeFormatDate = (dateStr, formatStr = 'dd/MM/yyyy') => {
  try {
    if (!dateStr) return 'Data não informada';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Data inválida';
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return 'Erro na data';
  }
};

import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AnimalIcon from '../components/animals/AnimalIcon';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import PrescriptionForm from '../components/appointments/PrescriptionForm';
import { Calendar as CalendarPicker } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { offlineFetch, enqueueMutation, authFetch, getApiBaseUrl } from '../lib/offline';
import { compareIds, deepClean, cn } from '../lib/utils';
import { getWhatsAppLink, isValidWhatsAppNumber } from '../components/utils/whatsapp';
import { generatePrescriptionPDF } from '../components/appointments/PrescriptionPDF';
import { useAuth } from '../lib/AuthContextJWT';
import {
  getAppointmentAnimalIds,
  getAppointmentClientId,
  normalizeAppointmentForAnalysis
} from '../lib/appointments';

const SPECIES = [
  { value: 'bovino', label: 'Bovino' },
  { value: 'equino', label: 'Equino' },
  { value: 'ovino', label: 'Ovino' },
  { value: 'caprino', label: 'Caprino' },
  { value: 'suino', label: 'Suíno' },
  { value: 'bubalino', label: 'Bubalino' },
  { value: 'outro', label: 'Outro' }
];

export default function Prescriptions() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterAnimal, setFilterAnimal] = useState('all');
  const [filterSpecies, setFilterSpecies] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // New Prescription Modal State
  const [isNewPrescriptionModalOpen, setIsNewPrescriptionModalOpen] = useState(false);
  const [newPrescriptionData, setNewPrescriptionData] = useState({
    client_id: '',
    animal_ids: [],
    date: new Date().toISOString().slice(0, 10),
    medications: [],
    notes: '',
    diagnosis: '',
    symptoms: ''
  });

  const { user } = useAuth();
  const prescriptionFormRef = useRef(null);

  const { data: prescriptions = [], isLoading: isLoadingPrescriptions, refetch: refetchPrescriptions, isRefetching: isRefetchingPrescriptions } = useQuery({
    queryKey: ['prescriptions', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const res = await offlineFetch(`/api/prescriptions?created_by=${isAdmin ? '' : email}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: clients = [], isLoading: isLoadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const res = await offlineFetch(`/api/clients?created_by=${isAdmin ? '' : email}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: animals = [], isLoading: isLoadingAnimals, refetch: refetchAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const res = await offlineFetch(`/api/animals?created_by=${isAdmin ? '' : email}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: appointments = [], isLoading: isLoadingAppointments, refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const res = await offlineFetch(`/api/appointments?created_by=${isAdmin ? '' : email}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: userSettings = {} } = useQuery({
    queryKey: ['settings', user?.email],
    queryFn: async () => {
      const settings = await offlineFetch('/api/settings');
      return settings && typeof settings === 'object' ? settings : {};
    },
    enabled: !!user?.email
  });

  const { data: rawVetProfile, isLoading: isLoadingVet, refetch: refetchVetProfile } = useQuery({
    queryKey: ['vetProfile', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const profiles = await offlineFetch(`/api/vetprofiles?created_by=${isAdmin ? '' : email}`);
      return profiles[0] || null;
    },
    enabled: !!user?.email
  });

  const vetProfile = useMemo(() => {
    if (!rawVetProfile && (!userSettings || Object.keys(userSettings).length === 0)) return null;
    return {
      ...(rawVetProfile || {}),
      ...(userSettings || {})
    };
  }, [rawVetProfile, userSettings]);

  const isLoading = isLoadingPrescriptions || isLoadingClients || isLoadingAnimals || isLoadingAppointments || isLoadingVet;

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchPrescriptions(),
        refetchClients(),
        refetchAnimals(),
        refetchAppointments(),
        refetchVetProfile()
      ]),
      {
        loading: 'Atualizando prescrições...',
        success: 'Prescrições atualizadas!',
        error: 'Erro ao atualizar prescrições'
      }
    );
  };

  const isRefetching = isRefetchingPrescriptions;

  const createPrescription = useMutation(/** @type {any} */({
    mutationFn: async (payload) => {
      const finalPayload = deepClean({ 
        ...payload, 
        created_by: user?.email 
      }) || {};
      return enqueueMutation('/api/prescriptions', { 
        method: 'POST', 
        body: finalPayload
      });
    },
    onSuccess: async (res, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['prescriptions', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['movements', user?.email] });
      toast.success(res?.queued ? 'Prescrição enfileirada para sincronização' : 'Prescrição criada com sucesso!');
      setIsNewPrescriptionModalOpen(false);
      setNewPrescriptionData({
        client_id: '',
        animal_ids: [],
        date: new Date().toISOString().slice(0, 10),
        medications: [],
        notes: '',
        diagnosis: '',
        symptoms: ''
      });
    },
    onError: () => {
      toast.error('Erro ao criar prescrição');
    }
  }));

  const handleCreatePrescription = () => {
    const committedMedications = prescriptionFormRef.current?.commitPendingMedication?.();
    const nextMedications = Array.isArray(committedMedications)
      ? committedMedications
      : (newPrescriptionData.medications || []);
    const payload = { ...newPrescriptionData, medications: nextMedications };

    if (!payload.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if ((payload.animal_ids || []).length === 0) {
      toast.error('Selecione pelo menos um animal');
      return;
    }
    if ((payload.medications || []).length === 0) {
      toast.error('Adicione pelo menos um medicamento');
      return;
    }

    setNewPrescriptionData(payload);
    createPrescription.mutate(/** @type {any} */ (payload));
  };

  const clientAnimals = (animals || []).filter((animal) => {
    if (!animal || !newPrescriptionData.client_id) return false;
    const animalClientId = animal.client_id || animal.clientId || animal.owner_id || animal.ownerId || animal.id_client;
    const nestedClientId = animal.client?.id || animal.client?._id || animal.owner?.id || animal.owner?._id;
    return compareIds(animalClientId, newPrescriptionData.client_id) || compareIds(nestedClientId, newPrescriptionData.client_id);
  });

  const toggleAnimal = (id) => {
    setNewPrescriptionData(prev => {
      const exists = (prev.animal_ids || []).some(aid => compareIds(aid, id));
      const updated = exists 
        ? prev.animal_ids.filter(aid => !compareIds(aid, id)) 
        : [...(prev.animal_ids || []), id];
      return { ...prev, animal_ids: updated };
    });
  };

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

  const getClientName = (clientId) => (clients || []).find(c => c && compareIds(c.id || c._id, clientId))?.name || '-';
  const getAnimalNames = (animalIds) => {
    if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) return '-';
    return (animalIds || []).map(id => (animals || []).find(a => a && compareIds(a.id || a._id, id))?.name || '-').join(', ');
  };
  const getAnimalSpecies = (animalIds) => {
    if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) return null;
    const animal = (animals || []).find(a => a && compareIds(a.id || a._id, animalIds[0]));
    return animal?.species || null;
  };
  const normalizedAppointments = useMemo(
    () => (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean),
    [appointments]
  );
  const getAppointmentType = (appointmentId) => {
    const appt = normalizedAppointments.find(a => a && compareIds(a.id || a._id, appointmentId));
    const types = {
      clinico: 'Clínico',
      reprodutivo: 'Reprodutivo',
      cirurgico: 'Cirúrgico',
      sanitario: 'Sanitário',
      preventivo: 'Preventivo',
      consultoria: 'Consultoria'
    };
    return types[appt?.type] || '-';
  };

  const allPrescriptions = useMemo(() => {
    const explicit = Array.isArray(prescriptions) ? prescriptions : [];
    const explicitAppointmentIds = new Set(
      explicit
        .map((p) => p?.appointment_id)
        .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
        .map((id) => String(id))
    );

    const fromAppointments = normalizedAppointments
      .filter((appt) => appt && (appt.id || appt._id))
      .filter((appt) => Array.isArray(appt.medications) && appt.medications.length > 0)
      .filter((appt) => !explicitAppointmentIds.has(String(appt.id || appt._id)))
      .map((appt) => {
        const appointmentIdentifier = appt.id || appt._id;
        const animalIds = getAppointmentAnimalIds(appt);

        return {
          id: `appointment_${appointmentIdentifier}`,
          client_id: getAppointmentClientId(appt),
          animal_ids: animalIds,
          appointment_id: appointmentIdentifier,
          date: appt.date,
          medications: appt.medications,
          notes: appt.observations || '',
          symptoms: appt.symptoms || '',
          diagnosis: appt.diagnosis || '',
          created_by: appt.created_by
        };
      });

    const combined = [...explicit, ...fromAppointments];
    combined.sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : 0;
      const db = b?.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    return combined;
  }, [prescriptions, normalizedAppointments]);

  const filteredPrescriptions = (allPrescriptions || []).filter(p => {
    if (!p) return false;
    try {
      const matchesSearch = getClientName(p.client_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                           getAnimalNames(p.animal_ids).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = filterClient === 'all' || compareIds(p.client_id, filterClient);
      const matchesAnimal = filterAnimal === 'all' || (Array.isArray(p.animal_ids) && p.animal_ids.some(aid => compareIds(aid, filterAnimal)));
      const matchesSpecies = filterSpecies === 'all' || getAnimalSpecies(p.animal_ids) === filterSpecies;
      
      const prescriptionDate = p.date ? new Date(p.date) : null;
      if (!prescriptionDate && (filterDateFrom || filterDateTo)) return false;

      const matchesDateFrom = !filterDateFrom || (prescriptionDate && prescriptionDate >= new Date(filterDateFrom));
      const matchesDateTo = !filterDateTo || (prescriptionDate && prescriptionDate <= new Date(filterDateTo + 'T23:59:59'));
      
      return matchesSearch && matchesClient && matchesAnimal && matchesSpecies && matchesDateFrom && matchesDateTo;
    } catch (error) {
      console.error('Error filtering prescription:', error, p);
      return false;
    }
  });

  const uniqueAnimals = [...new Map((animals || []).filter(a => a && (a.id || a._id)).map(a => [String(a.id || a._id), a])).values()];

  const activeFiltersCount = [filterClient, filterAnimal, filterSpecies, filterDateFrom, filterDateTo]
    .filter(f => f && f !== 'all').length;

  const selectedPrescriptionDate = useMemo(() => {
    if (!newPrescriptionData.date) return undefined;
    const parsed = new Date(`${newPrescriptionData.date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [newPrescriptionData.date]);

  const buildSyntheticAppointment = (prescription) => ({
    id: prescription.id || prescription._id || prescription.appointment_id,
    date: prescription.date,
    diagnosis: prescription.diagnosis || '',
    medications: prescription.medications || [],
    symptoms: prescription.symptoms || '',
    prescription_notes: prescription.notes || '',
    observations: prescription.notes || ''
  });

  const handleDownloadPDF = async (prescription) => {
    try {
      if (!prescription) return;
      const client = (clients || []).find(c => c && compareIds(c.id || c._id, prescription.client_id));
      const animalsList = (animals || []).filter(a => a && (prescription.animal_ids || []).some(aid => compareIds(aid, a.id || a._id)));
      const syntheticAppointment = buildSyntheticAppointment(prescription);
      await generatePrescriptionPDF(syntheticAppointment, client, animalsList, vetProfile);
      toast.success('Prescrição baixada com sucesso!');
    } catch (e) {
      console.error('Error generating PDF:', e);
      toast.error('Erro ao gerar PDF da prescrição');
    }
  };

  const handleViewPrescription = async (prescription) => {
    try {
      if (!prescription) return;
      const client = (clients || []).find(c => c && compareIds(c.id || c._id, prescription.client_id));
      const animalsList = (animals || []).filter(a => a && (prescription.animal_ids || []).some(aid => compareIds(aid, a.id || a._id)));
      const syntheticAppointment = buildSyntheticAppointment(prescription);
      const previewUrl = await generatePrescriptionPDF(syntheticAppointment, client, animalsList, vetProfile, { output: 'bloburl' });
      if (!previewUrl) {
        toast.error('Não foi possível abrir a visualização');
        return;
      }
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
    } catch (e) {
      console.error('Error previewing prescription PDF:', e);
      toast.error('Erro ao visualizar prescrição');
    }
  };

  const handleSendWhatsApp = async (prescription) => {
    if (!prescription) return;
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, prescription.client_id));
    if (!client?.phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    if (!isValidWhatsAppNumber(client.phone)) {
      toast.error('Número de WhatsApp inválido');
      return;
    }
    const loadingToast = toast.loading('Preparando PDF da prescrição...');
    try {
      const animalsList = (animals || []).filter(a => a && (prescription.animal_ids || []).some(aid => compareIds(aid, a.id || a._id)));
      const syntheticAppointment = buildSyntheticAppointment(prescription);
      const pdfBlob = await generatePrescriptionPDF(syntheticAppointment, client, animalsList, vetProfile, { output: 'blob' });
      const formData = new FormData();
      const prescriptionCode = String(prescription.id || prescription._id || prescription.appointment_id || 'prescricao').slice(-8);
      formData.append('file', pdfBlob, `prescricao_${prescriptionCode}.pdf`);

      const uploadRes = await authFetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const detail = await uploadRes.text().catch(() => '');
        throw new Error(`Falha no upload do PDF (${uploadRes.status}): ${detail}`);
      }
      const uploaded = await uploadRes.json();
      const pdfUrl = typeof uploaded?.url === 'string'
        ? (uploaded.url.startsWith('http') ? uploaded.url : `${getApiBaseUrl()}${uploaded.url}`)
        : null;
      if (!pdfUrl) {
        throw new Error('Resposta de upload inválida');
      }

      const message = [
        `Olá ${client.name}! 👋`,
        ``,
        `Segue a prescrição de ${safeFormatDate(prescription.date, 'dd/MM/yyyy')}.`,
        `Contém ${prescription.medications?.length || 0} medicamento(s).`,
        ``,
        `📄 *Baixar Prescrição PDF:*`,
        pdfUrl,
        ``,
        `Qualquer dúvida, estou à disposição.`,
      ].join('\n');
      const link = getWhatsAppLink(client.phone, message);
      if (!link) {
        throw new Error('Não foi possível montar o link do WhatsApp');
      }
      window.open(link, '_blank');
      toast.success('WhatsApp aberto com a prescrição em PDF');
    } catch (e) {
      console.error('Error sending prescription via WhatsApp:', e);
      toast.error('Erro ao enviar prescrição por WhatsApp');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Prescrições</h1>
            <p className="text-[var(--text-muted)] mt-1">Histórico de prescrições geradas nos atendimentos</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <Button 
              onClick={handleManualRefresh}
              variant="outline"
              disabled={isRefetching}
              className={`border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-xl font-medium ${isRefetching ? 'animate-pulse' : ''}`}
            >
              <RotateCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button 
              onClick={() => setIsNewPrescriptionModalOpen(true)}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white gap-2 h-12 px-6 rounded-xl font-medium"
            >
              <Plus className="w-5 h-5" />
              Nova Prescrição
            </Button>
          </div>
        </div>

      {/* Filters - Desktop */}
      <Card className="hidden md:block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label className="text-sm mb-2">Buscar</Label>
              <Input
                placeholder="Cliente, animal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
              />
            </div>
            <div>
              <Label className="text-sm mb-2">Cliente</Label>
              <select 
                value={filterClient} 
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                {clients.map(c => (
                  <option key={c.id || c._id} value={String(c.id || c._id)}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Animal</Label>
              <select 
                value={filterAnimal} 
                onChange={(e) => setFilterAnimal(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                {uniqueAnimals.map(a => (
                  <option key={a.id || a._id} value={String(a.id || a._id)}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Espécie</Label>
              <select 
                value={filterSpecies} 
                onChange={(e) => setFilterSpecies(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todas</option>
                {SPECIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Período</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                  placeholder="De"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Filter Button */}
      <div className="md:hidden">
        <Button
          onClick={() => setIsFilterDrawerOpen(true)}
          variant="outline"
          className="w-full h-12 rounded-xl border-[var(--border-color)] bg-[var(--bg-card)] gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtrar
          {activeFiltersCount > 0 && (
            <Badge className="bg-[#22c55e] text-white ml-2">{activeFiltersCount}</Badge>
          )}
        </Button>
      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-2">Buscar</Label>
            <Input
              placeholder="Cliente, animal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
            />
          </div>
          <div>
            <Label className="text-sm mb-2">Cliente</Label>
            <select 
              value={filterClient} 
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">Todos</option>
              {clients.map(c => (
                <option key={c.id || c._id} value={String(c.id || c._id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm mb-2">Animal</Label>
            <select 
              value={filterAnimal} 
              onChange={(e) => setFilterAnimal(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">Todos</option>
              {uniqueAnimals.map(a => (
                <option key={a.id || a._id} value={String(a.id || a._id)}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm mb-2">Espécie</Label>
            <select 
              value={filterSpecies} 
              onChange={(e) => setFilterSpecies(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">Todas</option>
              {SPECIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm mb-2">Data inicial</Label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
            />
          </div>
          <div>
            <Label className="text-sm mb-2">Data final</Label>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
            />
          </div>
        </div>
      </MobileFilterDrawer>

      {/* Prescriptions List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredPrescriptions.length === 0 ? (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-primary)] font-semibold text-lg">Nenhuma prescrição encontrada</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">As prescrições aparecerão aqui após serem geradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPrescriptions.map((prescription, index) => {
            const species = getAnimalSpecies(prescription.animal_ids);
            return (
              <motion.div
                key={prescription.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/40 transition-all group">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Icon + Main Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                          {species ? (
                            <AnimalIcon species={species} className="w-6 h-6 text-white" />
                          ) : (
                            <PawPrint className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                              {getClientName(prescription.client_id)}
                            </h3>
                            <Badge className="bg-[#22c55e]/10 text-[#16a34a] border-0 text-xs">
                              {getAppointmentType(prescription.appointment_id)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5">
                              <AnimalIcon 
                                species={species || 'bovino'} 
                                white={false}
                                className="w-3.5 h-3.5 opacity-70" 
                              />
                              <span>{getAnimalNames(prescription.animal_ids)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{format(new Date(prescription.date), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5" />
                              <span>{prescription.medications?.length || 0} medicamentos</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 md:ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPrescription(prescription)}
                          className="h-9 px-3 rounded-lg text-[#22c55e] hover:bg-[#22c55e]/10"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(prescription)}
                          className="h-9 px-3 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                          title="Baixar PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendWhatsApp(prescription)}
                          className="h-9 px-3 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                          title="Enviar WhatsApp"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CRMV Info */}
      {vetProfile && (
        <Card className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-[var(--text-primary)]">
                {vetProfile.full_name || 'Veterinário'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                CRMV: {vetProfile.crmv || 'Não informado'} - {vetProfile.crmv_state || 'UF'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Prescription Dialog */}
      <Dialog open={isNewPrescriptionModalOpen} onOpenChange={setIsNewPrescriptionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto !bg-white dark:!bg-[#16161a] border-[var(--border-color)] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
              <Plus className="w-6 h-6 text-[#22c55e]" />
              Nova Prescrição
            </DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Preencha as informações abaixo para gerar uma nova prescrição veterinária.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl h-11 border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
                        !selectedPrescriptionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
                      {selectedPrescriptionDate ? (
                        format(selectedPrescriptionDate, "PPP", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]" align="start" side="bottom" sideOffset={8}>
                    <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1">
                      <CalendarPicker
                        mode="single"
                        selected={selectedPrescriptionDate}
                        onSelect={(date) => setNewPrescriptionData({
                          ...newPrescriptionData,
                          date: date ? format(date, 'yyyy-MM-dd') : ''
                        })}
                        initialFocus
                        locale={ptBR}
                        className="bg-[var(--bg-card)] text-[var(--text-primary)]"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Cliente *</Label>
                <select
                  value={newPrescriptionData.client_id}
                  onChange={(e) => setNewPrescriptionData({ ...newPrescriptionData, client_id: e.target.value, animal_ids: [] })}
                  className="w-full h-11 px-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(c => (
                    <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Animal Selection */}
            {newPrescriptionData.client_id && (
              <div className="space-y-3">
                <Label className="text-[var(--text-primary)]">Animais * (Selecione um ou mais)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {clientAnimals.map(animal => (
                    <div
                      key={animal.id || animal._id}
                      onClick={() => toggleAnimal(animal.id || animal._id)}
                      className={`
                        relative cursor-pointer p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                        ${newPrescriptionData.animal_ids.some(aid => compareIds(aid, animal.id || animal._id))
                          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                          : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] opacity-60 hover:opacity-100'}
                      `}
                    >
                      <AnimalIcon species={animal.species} className="w-8 h-8" white={false} />
                      <span className="text-xs font-medium text-center truncate w-full">
                        {animal.name}
                      </span>
                      {newPrescriptionData.animal_ids.some(aid => compareIds(aid, animal.id || animal._id)) && (
                        <div className="absolute top-1 right-1">
                          <div className="bg-[var(--accent)] text-white rounded-full p-0.5">
                            <Plus className="w-3 h-3 rotate-45" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {clientAnimals.length === 0 && (
                  <p className="text-sm text-red-500">Este cliente não possui animais cadastrados.</p>
                )}
              </div>
            )}

            {/* Symptoms & Diagnosis (Optional but useful) */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Sintomas (Opcional)</Label>
                <Textarea
                  value={newPrescriptionData.symptoms}
                  onChange={(e) => setNewPrescriptionData({ ...newPrescriptionData, symptoms: e.target.value })}
                  placeholder="Descreva os sintomas observados..."
                  className="bg-[var(--bg-tertiary)] border-[var(--border-color)] rounded-xl min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Diagnóstico (Opcional)</Label>
                <Textarea
                  value={newPrescriptionData.diagnosis}
                  onChange={(e) => setNewPrescriptionData({ ...newPrescriptionData, diagnosis: e.target.value })}
                  placeholder="Informe o diagnóstico clínico..."
                  className="bg-[var(--bg-tertiary)] border-[var(--border-color)] rounded-xl min-h-[80px]"
                />
              </div>
            </div>

            {/* Prescription Form */}
            <div className="space-y-2">
              <Label className="text-[var(--text-primary)] text-lg font-semibold">Medicamentos *</Label>
              <PrescriptionForm
                ref={prescriptionFormRef}
                medications={newPrescriptionData.medications}
                onChange={(meds) => setNewPrescriptionData({ ...newPrescriptionData, medications: meds })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-[var(--text-primary)]">Observações Adicionais</Label>
              <Textarea
                value={newPrescriptionData.notes}
                onChange={(e) => setNewPrescriptionData({ ...newPrescriptionData, notes: e.target.value })}
                placeholder="Instruções gerais, recomendações de retorno, etc."
                className="bg-[var(--bg-tertiary)] border-[var(--border-color)] rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsNewPrescriptionModalOpen(false)}
              className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePrescription}
              disabled={createPrescription.isPending}
              className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl px-8 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
            >
              {createPrescription.isPending ? 'Criando...' : 'Gerar Prescrição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
