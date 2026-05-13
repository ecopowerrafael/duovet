import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Stethoscope,
  Pill,
  Calculator,
  Save,
  Navigation
} from 'lucide-react';
import PrescriptionForm from '../components/appointments/PrescriptionForm';
import ReturnScheduler from '../components/appointments/ReturnScheduler';
import AndrologicalDataForm from '../components/appointments/AndrologicalDataForm';
import ReproductiveGynecologicalForm from '../components/appointments/ReproductiveGynecologicalForm';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { getSettings } from '../lib/api';

const parseMonetaryValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    let normalized = value.trim().replace(/R\$\s?/g, '');
    if (normalized.includes(',')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    }
    normalized = normalized.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatMoney = (value) =>
  (Number(value) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const TYPES = [
  { value: 'clinico', label: 'Clínico' },
  { value: 'reprodutivo', label: 'Reprodutivo' },
  { value: 'cirurgico', label: 'Cirúrgico' },
  { value: 'sanitario', label: 'Sanitário' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'odontologico', label: 'Odontológico' }
];

const SUBTYPES = {
  reprodutivo: [
    { value: 'ia', label: 'Inseminação Artificial (IA)' },
    { value: 'iatf', label: 'IATF' },
    { value: 'diagnostico_gestacao', label: 'Diagnóstico de Gestação' },
    { value: 'coleta_embriao', label: 'Coleta de Embrião' },
    { value: 'transferencia_embriao', label: 'Transferência de Embrião' },
    { value: 'exame_andrológico', label: 'Exame Andrológico' },
    { value: 'outros', label: 'Outros' }
  ]
};

import { offlineFetch, enqueueMutation } from '../lib/offline';
import { formatCurrency, parseCurrency, normalizeId, compareIds, deepClean } from '../lib/utils';
import { useAuth } from '../lib/AuthContextJWT';
import { getRecordClientId, getRecordPropertyId } from '../lib/appointments';

export default function NewAppointment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    type: '',
    subtype: '',
    date: new Date().toISOString(),
    client_id: '',
    property_id: '',
    animal_ids: [],
    lot_id: '',
    attendance_mode: 'individual', // 'individual' or 'lot'
    symptoms: '',
    diagnosis: '',
    procedures: [],
    medications: [],
    reproductive_data: {
      protocol: '',
      semen: '',
      semen_packaging: '',
      semen_packaging_other: '',
      pregnancy_result: '',
      pregnancy_positive_count: '',
      pregnancy_positive_percentage: '',
      embryo_donor: '',
      embryo_recipient: '',
      cervix: '',
      ut: '',
      oe: '',
      od: '',
      observations: ''
    },
    andrological_data: {
      volume: '',
      motility: '',
      vigor: '',
      concentration_ml: '',
      total_concentration: '',
      observations: ''
    },
    consultoria_data: {
      consultancy_id: '',
      service_type: '',
      description: '',
      duration: '',
      start_time: '',
      end_time: '',
      technical_notes: ''
    },
    observations: '',
    status: 'em_andamento',
    needs_return: false,
    return_date: null,
    return_time: null,
    return_type: null,
    return_notes: null,
    return_status: 'pendente',
    custom_displacement_cost: null
  });

  const [newProcedure, setNewProcedure] = useState({ name: '', value: '' });

  const { data: clients = [], isLoading: isLoadingClients, refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${email || ''}`;
      const res = await offlineFetch(url);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: properties = [], isLoading: isLoadingProperties, refetch: refetchProperties } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${email || ''}`;
      const res = await offlineFetch(url);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: animals = [], isLoading: isLoadingAnimals, refetch: refetchAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/animals' : `/api/animals?created_by=${email || ''}`;
      const res = await offlineFetch(url);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: lots = [], isLoading: isLoadingLots, refetch: refetchLots } = useQuery({
    queryKey: ['lots', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/lots' : `/api/lots?created_by=${email || ''}`;
      const res = await offlineFetch(url);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: consultancies = [], isLoading: isLoadingConsultancies, refetch: refetchConsultancies } = useQuery({
    queryKey: ['consultancies', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/consultancies' : `/api/consultancies?created_by=${email || ''}`;
      const res = await offlineFetch(url);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchClients(),
        refetchProperties(),
        refetchAnimals(),
        refetchLots(),
        refetchConsultancies()
      ]),
      {
        loading: 'Atualizando dados...',
        success: 'Dados atualizados com sucesso!',
        error: 'Erro ao atualizar dados'
      }
    );
  };

  const isLoading = isLoadingClients || isLoadingProperties || isLoadingAnimals || isLoadingLots || isLoadingConsultancies;

  const createAppointment = useMutation({
    mutationFn: async () => {
      // Clean and prepare payload
      const payload = {
        ...formData,
        animal_id: formData.attendance_mode === 'individual' && formData.animal_ids.length > 0 
          ? formData.animal_ids[0] 
          : null,
        total_procedures: totalProcedures,
        total_medications: totalMedications,
        displacement_cost: displacementCost,
        total_amount: totalAmount,
        created_by: user?.email
      };

      // Clean procedures and medications values before deep cleaning
      if (payload.procedures) {
        payload.procedures = payload.procedures.map(p => ({
          ...p,
          value: typeof p.value === 'string' ? parseCurrency(p.value) : p.value
        }));
      }

      if (payload.medications) {
        payload.medications = payload.medications.map(m => ({
          ...m,
          price: typeof m.price === 'string' ? parseCurrency(m.price) : m.price,
          quantity: parseFloat(m.quantity) || 1
        }));
      }

      // Remove nested objects that are not relevant to the appointment type
      if (payload.type === 'reprodutivo') {
        if (payload.subtype === 'exame_andrológico') {
          delete payload.reproductive_data;
        } else {
          delete payload.andrological_data;
          if (payload.subtype === 'diagnostico_gestacao' && payload.attendance_mode === 'lot') {
            const lotQuantity = Number(selectedLot?.quantity) || 0;
            const positiveCount = Number(payload.reproductive_data?.pregnancy_positive_count) || 0;
            payload.reproductive_data.pregnancy_positive_count = positiveCount;
            payload.reproductive_data.pregnancy_positive_percentage = lotQuantity > 0
              ? Number(((positiveCount / lotQuantity) * 100).toFixed(2))
              : 0;
          } else if (payload.reproductive_data) {
            delete payload.reproductive_data.pregnancy_positive_count;
            delete payload.reproductive_data.pregnancy_positive_percentage;
          }
        }
      } else {
        delete payload.reproductive_data;
        delete payload.andrological_data;
      }
      
      if (payload.type !== 'consultoria') {
        delete payload.consultoria_data;
      }

      // If in lot mode, we don't send individual animal_ids
      if (payload.attendance_mode === 'lot') {
        payload.animal_ids = [];
      } else {
        // In individual mode, we don't send lot_id
        delete payload.lot_id;
      }

      // Clean up return fields if not needed
      if (!payload.needs_return) {
        delete payload.return_date;
        delete payload.return_time;
        delete payload.return_type;
        delete payload.return_notes;
        delete payload.return_status;
      }

      // Final robust deep cleanup
      const finalPayload = deepClean(payload) || {};

      console.log('[NewAppointment] Sending payload:', finalPayload);
      return enqueueMutation('/api/appointments', { method: 'POST', body: finalPayload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['movements', user?.email] });
      toast.success(res?.queued ? 'Atendimento enfileirado para sincronização' : 'Atendimento registrado com sucesso!');
      const redirectId = res?.id || res?.queuedId;
      if (redirectId) {
        window.location.href = createPageUrl('AppointmentDetail') + `?id=${redirectId}&action=confirmCreation`;
        return;
      }
      window.location.href = createPageUrl('Appointments');
    },
    onError: (err) => {
      console.error('[NewAppointment] Erro ao criar atendimento:', err);
      toast.error('Erro ao criar atendimento: ' + (err?.message || 'Erro desconhecido') + (err?.stack ? `\n${err.stack}` : ''));
      if (err?.queuedId) {
        toast.info('A operação foi enfileirada, mas ocorreu um erro inesperado. Verifique a fila offline.');
      }
    }
  });

  const clientProperties = (properties || []).filter(p => {
    if (!p || !formData.client_id) return false;
    const propClientId = getRecordClientId(p);
    return compareIds(propClientId, formData.client_id);
  });
  const clientAnimals = (animals || []).filter(a => {
    if (!a || !formData.client_id) return false;
    
    // Normalização robusta de IDs usando utilitários
    const animalClientId = getRecordClientId(a);
    
    const matchesClient = compareIds(animalClientId, formData.client_id);
    
    // Se não tiver propriedade selecionada, mostra todos os animais do cliente
    if (!formData.property_id) return matchesClient;
    
    // Se tiver propriedade selecionada, filtra por ela também
    const animalPropertyId = getRecordPropertyId(a);
    const matchesProperty = compareIds(animalPropertyId, formData.property_id);
    
    return matchesClient && matchesProperty;
  });
  const clientLots = (lots || []).filter(l => {
    if (!l || !formData.client_id) return false;
    const lotClientId = getRecordClientId(l);
    const matchesClient = compareIds(lotClientId, formData.client_id);
    
    const lotPropertyId = getRecordPropertyId(l);
    const matchesProperty = !formData.property_id || compareIds(lotPropertyId, formData.property_id);
    
    return matchesClient && matchesProperty;
  });
  const consultancyClientIds = new Set(
    (consultancies || [])
      .map(c => normalizeId(getRecordClientId(c)))
      .filter(Boolean)
  );
  const selectableClients = formData.type === 'consultoria'
    ? (clients || []).filter(c => consultancyClientIds.has(normalizeId(c?.id || c?._id)))
    : (clients || []);
  const eligibleConsultancies = (consultancies || [])
    .filter(c => c && normalizeId(c.status) !== 'encerrada')
    .filter(c => compareIds(getRecordClientId(c), formData.client_id));
  const selectedConsultancy = eligibleConsultancies.find(c => compareIds(c.id || c._id, formData.consultoria_data?.consultancy_id)) || null;
  
  const toggleAnimal = (id) => {
    setFormData(prev => {
      if (!id) return prev;
      
      const exists = prev.animal_ids.some(aid => compareIds(aid, id));
      const updated = exists 
        ? prev.animal_ids.filter(aid => !compareIds(aid, id)) 
        : [...prev.animal_ids, id];
      return { ...prev, animal_ids: updated };
    });
  };

  const addProcedure = () => {
    const valueNum = typeof newProcedure.value === 'string' ? parseCurrency(newProcedure.value) : Number(newProcedure.value) || 0;
    if (!newProcedure.name) return;
    setFormData(prev => ({
      ...prev,
      procedures: [...prev.procedures, { name: newProcedure.name, value: valueNum }]
    }));
    setNewProcedure({ name: '', value: '' });
  };

  const removeProcedure = (index) => {
    setFormData(prev => ({
      ...prev,
      procedures: prev.procedures.filter((_, i) => i !== index)
    }));
  };

  const totalProcedures = Array.isArray(formData.procedures)
    ? formData.procedures.reduce((sum, procedure) => sum + parseMonetaryValue(procedure?.value), 0)
    : 0;
  const totalMedications = Array.isArray(formData.medications)
    ? formData.medications.reduce((sum, medication) => {
        const unitPrice = parseMonetaryValue(medication?.price ?? medication?.value);
        const quantity = parseMonetaryValue(medication?.quantity);
        const safeQuantity = quantity > 0 ? quantity : 1;
        return sum + (unitPrice * safeQuantity);
      }, 0)
    : 0;
  const selectedProperty = clientProperties.find(p => compareIds(p.id || p._id, formData.property_id)) || null;
  const selectedLot = clientLots.find(l => compareIds(l.id || l._id, formData.lot_id)) || null;
  const selectedLotQuantity = Number(selectedLot?.quantity) || 0;
  const pregnancyPositiveCount = Number(formData.reproductive_data?.pregnancy_positive_count) || 0;
  const pregnancyPositivePercentage = selectedLotQuantity > 0
    ? (pregnancyPositiveCount / selectedLotQuantity) * 100
    : 0;
  const kmRateRaw = settings?.km_rate;
  const kmRateParsed = Number(String(kmRateRaw ?? '').replace(',', '.'));
  const kmRate = Number.isFinite(kmRateParsed) && kmRateParsed > 0 ? kmRateParsed : 2.5;
  const calculatedDisplacementCost = selectedProperty?.distance_km ? (selectedProperty.distance_km * 2 * kmRate) : 0;
  const displacementCost = formData.custom_displacement_cost !== null ? Number(formData.custom_displacement_cost) || 0 : calculatedDisplacementCost;
  const totalAmount = totalProcedures + totalMedications + displacementCost;

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const animalId = urlParams.get('animal');
    const lotId = urlParams.get('lot');

    if (animalId && animals.length > 0) {
      const animal = animals.find(a => compareIds(a.id || a._id, animalId));
      if (animal) {
        setFormData(prev => ({
          ...prev,
          client_id: normalizeId(getRecordClientId(animal)),
          property_id: normalizeId(getRecordPropertyId(animal)),
          animal_ids: [normalizeId(animal.id || animal._id)],
          attendance_mode: 'individual'
        }));
      }
    } else if (lotId && lots.length > 0) {
      const lot = lots.find(l => compareIds(l.id || l._id, lotId));
      if (lot) {
        setFormData(prev => ({
          ...prev,
          client_id: normalizeId(getRecordClientId(lot)),
          property_id: normalizeId(getRecordPropertyId(lot)),
          lot_id: normalizeId(lot.id || lot._id),
          attendance_mode: 'lot'
        }));
      }
    }
  }, [animals, lots]);

  React.useEffect(() => {
    if (formData.type !== 'consultoria') return;
    if (!formData.client_id) return;
    const isEligibleClient = selectableClients.some(c => compareIds(c.id || c._id, formData.client_id));
    if (!isEligibleClient) {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        property_id: '',
        animal_ids: [],
        lot_id: '',
        consultoria_data: {
          ...prev.consultoria_data,
          consultancy_id: ''
        }
      }));
    }
  }, [formData.type, formData.client_id, selectableClients]);

  React.useEffect(() => {
    if (formData.type !== 'consultoria') return;
    if (!selectedConsultancy) return;
    setFormData(prev => ({
      ...prev,
      property_id: normalizeId(getRecordPropertyId(selectedConsultancy) || ''),
      consultoria_data: {
        ...prev.consultoria_data,
        consultancy_id: normalizeId(selectedConsultancy.id || selectedConsultancy._id)
      }
    }));
  }, [formData.type, selectedConsultancy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.type) {
      toast.error('Selecione o tipo de atendimento');
      return;
    }

    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }

    if (formData.type !== 'consultoria' && formData.attendance_mode === 'individual' && formData.animal_ids.length === 0) {
      toast.error('Selecione pelo menos um animal');
      return;
    }

    if (formData.type !== 'consultoria' && formData.attendance_mode === 'lot' && !formData.lot_id) {
      toast.error('Selecione um lote');
      return;
    }

    if (formData.type === 'consultoria' && (!formData.consultoria_data.service_type || !formData.consultoria_data.description)) {
      toast.error('Preencha os campos obrigatórios da consultoria');
      return;
    }

    if (formData.type === 'consultoria' && !formData.consultoria_data.consultancy_id) {
      toast.error('Selecione a consultoria vinculada para registrar o relatório no perfil');
      return;
    }

    if (formData.type === 'reprodutivo' && formData.subtype === 'diagnostico_gestacao' && formData.attendance_mode === 'lot') {
      if (selectedLotQuantity <= 0) {
        toast.error('O lote selecionado não possui quantidade válida de animais');
        return;
      }
      if (!Number.isFinite(pregnancyPositiveCount) || pregnancyPositiveCount < 0 || pregnancyPositiveCount > selectedLotQuantity) {
        toast.error(`Informe um número de positivos entre 0 e ${selectedLotQuantity}`);
        return;
      }
    }

    // Validar valor de deslocamento
    if (formData.custom_displacement_cost !== null && formData.custom_displacement_cost < 0) {
      toast.error('O valor de deslocamento não pode ser negativo');
      return;
    }
    
    createAppointment.mutate();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Novo Atendimento</h1>
            <p className="text-[var(--text-muted)]">Registre um atendimento clínico completo</p>
          </div>
        </div>
        <Button 
          onClick={handleManualRefresh}
          variant="outline"
          className="rounded-xl gap-2"
        >
          Sincronizar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Basic Info */}
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
              <Stethoscope className="w-5 h-5 text-[var(--accent)]" />
              Informações do Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Atendimento *</Label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      type: nextType,
                      subtype: '',
                      client_id: nextType === 'consultoria' ? '' : prev.client_id,
                      property_id: nextType === 'consultoria' ? '' : prev.property_id,
                      animal_ids: nextType === 'consultoria' ? [] : prev.animal_ids,
                      lot_id: nextType === 'consultoria' ? '' : prev.lot_id,
                      attendance_mode: nextType === 'consultoria' ? 'individual' : prev.attendance_mode,
                      consultoria_data: nextType === 'consultoria'
                        ? { ...prev.consultoria_data, consultancy_id: '' }
                        : { ...prev.consultoria_data, consultancy_id: '' },
                      ...(nextType !== 'clinico' ? { symptoms: '', diagnosis: '' } : {})
                    }));
                  }}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o tipo</option>
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === 'reprodutivo' && (
                <div>
                  <Label>Procedimento Reprodutivo</Label>
                  <select
                    value={formData.subtype}
                    onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                    className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <option value="" disabled>Selecione o procedimento</option>
                    {SUBTYPES.reprodutivo.map((sub) => (
                      <option key={sub.value} value={sub.value}>
                        {sub.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.type === 'consultoria' && formData.type === 'odontologico' && (
                <div className="col-span-full border-t border-[var(--border-color)] pt-4 mt-2">
                  <Label>Descrição do Atendimento Odontológico *</Label>
                  <Textarea
                    value={formData.observations}
                    onChange={e => setFormData({ ...formData, observations: e.target.value })}
                    placeholder="Descreva o atendimento odontológico realizado..."
                    rows={3}
                    className="rounded-xl"
                  />
                </div>
              )}
                <div className="col-span-full border-t border-[var(--border-color)] pt-4 mt-2">
                  <h3 className="text-md font-semibold text-[var(--text-primary)] mb-4">Dados da Consultoria</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Área Técnica *</Label>
                      <select
                        value={formData.consultoria_data.service_type}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          consultoria_data: { ...formData.consultoria_data, service_type: e.target.value } 
                        })}
                        className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="" disabled>Selecione a área</option>
                        <option value="nutricao">Nutrição</option>
                        <option value="reproducao">Reprodução</option>
                        <option value="sanidade">Sanidade</option>
                        <option value="manejo">Manejo</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <Label>Duração (horas)</Label>
                      <Input
                        type="number"
                        value={formData.consultoria_data.duration}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          consultoria_data: { ...formData.consultoria_data, duration: e.target.value } 
                        })}
                        placeholder="Ex: 2"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="col-span-full">
                      <Label>Descrição do Serviço *</Label>
                      <Textarea
                        value={formData.consultoria_data.description}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          consultoria_data: { ...formData.consultoria_data, description: e.target.value } 
                        })}
                        placeholder="Descreva o serviço realizado..."
                        rows={3}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              <DateTimePicker
                label="Data e Hora *"
                date={formData.date}
                setDate={(date) => setFormData({ ...formData, date })}
              />

              <div>
                <Label>Cliente *</Label>
                <select
                  value={formData.client_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setFormData({ 
                      ...formData, 
                      client_id: selectedId, 
                      property_id: '',
                      animal_ids: [],
                      lot_id: '',
                      consultoria_data: {
                        ...formData.consultoria_data,
                        consultancy_id: ''
                      }
                    });
                  }}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>{formData.type === 'consultoria' ? 'Selecione cliente com consultoria' : 'Selecione o cliente'}</option>
                  {selectableClients.map((client) => {
                    const clientId = normalizeId(client.id || client._id);
                    return (
                      <option key={clientId} value={clientId}>{client.name}</option>
                    );
                  })}
                </select>
                {formData.type === 'consultoria' && selectableClients.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Nenhum cliente com consultoria cadastrada foi encontrado.</p>
                )}
              </div>

              <div>
                <Label>Propriedade</Label>
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  disabled={!formData.client_id}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                >
                  <option value="" disabled>Selecione a propriedade</option>
                  {clientProperties.map((property) => {
                    const propertyId = normalizeId(property.id || property._id);
                    return (
                      <option key={propertyId} value={propertyId}>{property.name}</option>
                    );
                  })}
                </select>
              </div>

              {formData.type === 'consultoria' && (
                <div className="md:col-span-2">
                  <Label>Consultoria Vinculada *</Label>
                  <select
                    value={formData.consultoria_data.consultancy_id}
                    onChange={(e) => {
                      const consultancyId = e.target.value;
                      const consultancy = eligibleConsultancies.find(c => compareIds(c.id || c._id, consultancyId));
                      setFormData(prev => ({
                        ...prev,
                        property_id: consultancy ? normalizeId(consultancy.property_id || consultancy.propertyId || '') : prev.property_id,
                        consultoria_data: {
                          ...prev.consultoria_data,
                          consultancy_id: consultancyId
                        }
                      }));
                    }}
                    disabled={!formData.client_id}
                    className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  >
                    <option value="" disabled>Selecione a consultoria</option>
                    {eligibleConsultancies.map((consultancy) => {
                      const consultancyId = normalizeId(consultancy.id || consultancy._id);
                      const labelProperty = (properties || []).find(p => compareIds(p.id || p._id, consultancy.property_id || consultancy.propertyId))?.name || 'Sem propriedade';
                      return (
                        <option key={consultancyId} value={consultancyId}>
                          {labelProperty} • {consultancy.type === 'recorrente' ? 'Recorrente' : 'Pontual'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Mode Selection */}
            {formData.client_id && formData.type !== 'consultoria' && (
              <div className="flex gap-4 p-1 bg-[var(--bg-tertiary)] rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, attendance_mode: 'individual', lot_id: '' })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    formData.attendance_mode === 'individual'
                      ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Animal Individual
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, attendance_mode: 'lot', animal_ids: [] })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    formData.attendance_mode === 'lot'
                      ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Lote de Animais
                </button>
              </div>
            )}

            {/* Selection based on mode */}
            {formData.client_id && formData.type !== 'consultoria' && (
              <div className="space-y-4">
                {formData.attendance_mode === 'individual' ? (
                  clientAnimals.length > 0 ? (
                    <div>
                      <Label className="mb-3 block">Animais Atendidos</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-[var(--bg-tertiary)] rounded-2xl">
                        {clientAnimals.map((animal) => {
                          const animalId = normalizeId(animal.id || animal._id);
                          const isChecked = formData.animal_ids.some(aid => compareIds(aid, animalId));
                          return (
                            <label 
                              key={animalId}
                              className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-[var(--accent)]/10 border-2 border-[var(--accent)]'
                                  : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-[var(--border-color)]'
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleAnimal(animalId)}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-[var(--text-primary)] truncate">{animal.name}</span>
                                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{animal.identification || 'S/ID'}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[var(--bg-tertiary)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
                      <p className="text-[var(--text-muted)]">Nenhum animal encontrado para este cliente.</p>
                      <Button 
                        variant="link" 
                        className="text-[var(--accent)]"
                        onClick={() => window.location.href = '/Animals'}
                      >
                        Cadastrar Animal
                      </Button>
                    </div>
                  )
                ) : (
                  clientLots.length > 0 ? (
                    <div>
                      <Label>Lote de Animais</Label>
                      <select
                        value={formData.lot_id}
                        onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
                        className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="" disabled>Selecione o lote</option>
                        {clientLots.map((lot) => {
                          const lotId = normalizeId(lot.id || lot._id);
                          return (
                            <option key={lotId} value={lotId}>{lot.name}</option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[var(--bg-tertiary)] rounded-2xl border-2 border-dashed border-[var(--border-color)]">
                      <p className="text-[var(--text-muted)]">Nenhum lote encontrado para este cliente.</p>
                      <Button 
                        variant="link" 
                        className="text-[var(--accent)]"
                        onClick={() => window.location.href = '/Animals'}
                      >
                        Cadastrar Lote
                      </Button>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Data */}
        {formData.type === 'clinico' && (
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
                <Stethoscope className="w-5 h-5 text-[var(--accent)]" />
                Dados Clínicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sintomas / Queixa Principal</Label>
                <Textarea
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  placeholder="Descreva os sintomas observados..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Diagnóstico Sugestivo</Label>
                <Input
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="Ex: Mastite clínica"
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consultoria Data */}
        {formData.type === 'consultoria' && (
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Dados da Consultoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Serviço *</Label>
                <select
                  value={formData.consultoria_data.service_type}
                  onChange={(e) => setFormData({
                    ...formData,
                    consultoria_data: { ...formData.consultoria_data, service_type: e.target.value }
                  })}
                  className="w-full h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o tipo</option>
                  <option value="consultoria_tecnica">Consultoria Técnica</option>
                  <option value="acompanhamento_produtivo">Acompanhamento Produtivo</option>
                  <option value="orientacao_sanitaria">Orientação Sanitária</option>
                  <option value="orientacao_nutricional">Orientação Nutricional</option>
                </select>
              </div>
              <div>
                <Label>Descrição da Consultoria *</Label>
                <Textarea
                  value={formData.consultoria_data.description}
                  onChange={(e) => setFormData({
                    ...formData,
                    consultoria_data: { ...formData.consultoria_data, description: e.target.value }
                  })}
                  placeholder="Descreva o objetivo e escopo da consultoria..."
                  rows={3}
                  className="rounded-xl"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Período/Duração</Label>
                  <Input
                    value={formData.consultoria_data.duration}
                    onChange={(e) => setFormData({
                      ...formData,
                      consultoria_data: { ...formData.consultoria_data, duration: e.target.value }
                    })}
                    placeholder="Ex: 3 meses, visita única, etc."
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label>Observações Técnicas</Label>
                <Textarea
                  value={formData.consultoria_data.technical_notes}
                  onChange={(e) => setFormData({
                    ...formData,
                    consultoria_data: { ...formData.consultoria_data, technical_notes: e.target.value }
                  })}
                  placeholder="Recomendações, análises técnicas, plano de ação..."
                  rows={4}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reproductive Data - Show based on selected subtype */}
         {formData.type === 'reprodutivo' && formData.subtype && (
               <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                 <CardHeader>
                   <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
                     <span>🧬</span>
                     Dados Reprodutivos - {SUBTYPES.reprodutivo.find(s => s.value === formData.subtype)?.label}
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="grid md:grid-cols-2 gap-4">
                     {(formData.subtype === 'ia' || formData.subtype === 'iatf') && (
                       <>
                         <div>
                           <Label>Protocolo</Label>
                           <Input
                             value={formData.reproductive_data.protocol}
                             onChange={(e) => setFormData({
                               ...formData,
                               reproductive_data: { ...formData.reproductive_data, protocol: e.target.value }
                             })}
                             placeholder="Protocolo utilizado"
                             className="h-10 rounded-lg"
                           />
                         </div>
                         <div>
                           <Label>Sêmen</Label>
                           <Input
                             value={formData.reproductive_data.semen}
                             onChange={(e) => setFormData({
                               ...formData,
                               reproductive_data: { ...formData.reproductive_data, semen: e.target.value }
                             })}
                             placeholder="Identificação, código ou origem do sêmen"
                             className="h-10 rounded-lg"
                           />
                         </div>
                         <div>
                           <Label>Acondicionamento do Sêmen</Label>
                           <select
                             value={formData.reproductive_data.semen_packaging}
                             onChange={(e) => setFormData({
                               ...formData,
                               reproductive_data: { ...formData.reproductive_data, semen_packaging: e.target.value }
                             })}
                             className="w-full h-10 px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                           >
                             <option value="" disabled>Selecione a forma</option>
                             <option value="congelado">Congelado</option>
                             <option value="refrigerado">Refrigerado</option>
                             <option value="fresco">Fresco</option>
                             <option value="outro">Outro</option>
                           </select>
                         </div>
                         {formData.reproductive_data.semen_packaging === 'outro' && (
                           <div>
                             <Label>Especifique</Label>
                             <Input
                               value={formData.reproductive_data.semen_packaging_other}
                               onChange={(e) => setFormData({
                                 ...formData,
                                 reproductive_data: { ...formData.reproductive_data, semen_packaging_other: e.target.value }
                               })}
                               placeholder="Especifique o acondicionamento"
                               className="h-10 rounded-lg"
                             />
                           </div>
                         )}
                       </>
                     )}
                     {formData.subtype === 'diagnostico_gestacao' && (
                      <>
                        <div>
                         <Label>Resultado</Label>
                         <select
                           value={formData.reproductive_data.pregnancy_result}
                           onChange={(e) => setFormData({
                             ...formData,
                             reproductive_data: { ...formData.reproductive_data, pregnancy_result: e.target.value }
                           })}
                           className="w-full h-10 px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                         >
                           <option value="" disabled>Resultado do diagnóstico</option>
                           <option value="positivo">Positivo</option>
                           <option value="negativo">Negativo</option>
                           <option value="inconclusivo">Inconclusivo</option>
                         </select>
                        </div>
                        {formData.attendance_mode === 'lot' && (
                          <div>
                            <Label>Animais Positivos</Label>
                            <Input
                              type="number"
                              min={0}
                              max={selectedLotQuantity || undefined}
                              value={formData.reproductive_data.pregnancy_positive_count}
                              onChange={(e) => setFormData({
                                ...formData,
                                reproductive_data: {
                                  ...formData.reproductive_data,
                                  pregnancy_positive_count: e.target.value
                                }
                              })}
                              placeholder={selectedLotQuantity > 0 ? `0 até ${selectedLotQuantity}` : 'Informe o total'}
                              className="h-10 rounded-lg bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)]"
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              {selectedLotQuantity > 0
                                ? `${pregnancyPositivePercentage.toFixed(2)}% positivos de ${selectedLotQuantity} animais no lote`
                                : 'Selecione um lote com quantidade válida para calcular o percentual'}
                            </p>
                          </div>
                        )}
                      </>
                     )}
                   </div>
                 </CardContent>
               </Card>
             )}

             {/* Exame Andrológico - Only when subtype is 'exame_andrológico' */}
             {formData.subtype === 'exame_andrológico' && (
               <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                 <CardHeader>
                   <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
                     <span>🧪</span>
                     Exame Andrológico
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <AndrologicalDataForm
                     data={formData.andrological_data}
                     onChange={(data) => setFormData({
                       ...formData,
                       andrological_data: data
                     })}
                   />
                 </CardContent>
               </Card>
             )}

             {/* Exame Ginecológico - For all other reproductive subtypes */}
             {formData.type === 'reprodutivo' && formData.subtype && formData.subtype !== 'exame_andrológico' && (
               <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                 <CardHeader>
                   <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
                     <span>🔬</span>
                     Exame Ginecológico
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <ReproductiveGynecologicalForm
                     data={formData.reproductive_data}
                     onChange={(data) => setFormData({
                       ...formData,
                       reproductive_data: data
                     })}
                   />
                 </CardContent>
               </Card>
             )}

        {/* Procedures */}
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
              <Stethoscope className="w-5 h-5 text-[var(--accent)]" />
              Procedimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.procedures.length > 0 && (
              <div className="space-y-2">
                {formData.procedures.map((procedure, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>{procedure.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        R$ {formatMoney(procedure?.value)}
                      </span>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeProcedure(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Input
                id="procedure-name-input"
                placeholder="Nome do procedimento"
                value={newProcedure.name}
                onChange={(e) => setNewProcedure({ ...newProcedure, name: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Valor"
                value={newProcedure.value}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setNewProcedure({ ...newProcedure, value: formatCurrency(value) });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addProcedure();
                    document.getElementById('procedure-name-input')?.focus();
                  }
                }}
                className="w-32"
              />
              <Button type="button" variant="outline" onClick={addProcedure}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prescription / Medications */}
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
              <Pill className="w-5 h-5 text-[var(--accent)]" />
              Prescrição de Medicamentos
            </CardTitle>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              A prescrição clínica será gerada automaticamente
            </p>
          </CardHeader>
          <CardContent>
            <PrescriptionForm
              medications={formData.medications}
              onChange={(medications) => setFormData((prev) => ({ ...prev, medications }))}
            />
          </CardContent>
        </Card>

        {/* Return Scheduler */}
        <ReturnScheduler
          returnData={{
            needs_return: formData.needs_return,
            return_date: formData.return_date,
            return_time: formData.return_time,
            return_type: formData.return_type,
            return_notes: formData.return_notes,
          }}
          onChange={(returnData) => setFormData((prev) => ({ ...prev, ...returnData }))}
        />

        {/* Observations */}
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="pt-6">
            <Label>Observações</Label>
            <Textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Observações adicionais..."
              rows={4}
              className="rounded-xl"
            />
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-[var(--accent-bg)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
              <Calculator className="w-5 h-5 text-[var(--accent)]" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Procedimentos</span>
              <span className="font-medium">
                R$ {formatMoney(totalProcedures)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Medicamentos</span>
              <span className="font-medium">
                R$ {formatMoney(totalMedications)}
              </span>
            </div>
            {(calculatedDisplacementCost > 0 || formData.custom_displacement_cost !== null) && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Navigation className="w-4 h-4" />
                    Deslocamento
                    {selectedProperty?.distance_km && (
                      <span className="text-xs text-[var(--text-muted)]">
                        ({selectedProperty.distance_km * 2} km x R$ {kmRate})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={formatCurrency(formData.custom_displacement_cost !== null ? (formData.custom_displacement_cost * 100).toString() : (calculatedDisplacementCost * 100).toString())}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/[^\d]/g, '');
                      const value = parseCurrency(numericValue);
                      setFormData({ 
                        ...formData, 
                        custom_displacement_cost: value 
                      });
                    }}
                    placeholder="R$ 0,00"
                    className="flex-1 h-10 rounded-lg text-right font-medium"
                  />
                </div>
                {formData.custom_displacement_cost !== null && formData.custom_displacement_cost !== calculatedDisplacementCost && (
                  <p className="text-xs text-amber-600 mt-1">
                    Valor alterado manualmente (original: R$ {formatMoney(calculatedDisplacementCost)})
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-between pt-3 border-t text-lg">
              <span className="font-semibold text-[#1a4d2e]">Total</span>
              <span className="font-bold text-[#1a4d2e]">
                R$ {formatMoney(totalAmount)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1 h-12 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => window.history.back()}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="flex-1 h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium gap-2 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
            disabled={createAppointment.isPending}
          >
            <Save className="w-4 h-4" />
            {createAppointment.isPending ? 'Salvando...' : 'Salvar Atendimento'}
          </Button>
        </div>
        </>
      )}
    </form>
  </div>
);
}
