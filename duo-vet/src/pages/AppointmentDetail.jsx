import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
// import { base44 } from '../api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Stethoscope,
  Pill,
  FileText,
  DollarSign,
  Check,
  Clock,
  Download,
  Navigation,
  Receipt,
  Camera,
  MessageCircle,
  Trash2
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

import { toast } from 'sonner';
import jsPDF from 'jspdf';
import PhotoGallery from '../components/appointments/PhotoGallery';
import PrescriptionForm from '../components/appointments/PrescriptionForm';
import { generatePrescriptionPDF } from '../components/appointments/PrescriptionPDF';
import { isValidWhatsAppNumber, openWhatsApp } from '../components/utils/whatsapp';

import { generateAuthorizationTermPDF } from '../components/appointments/AuthorizationTermPDF';

import AnimalIcon from '../components/animals/AnimalIcon';
import { compareIds, deepClean } from '../lib/utils';
import {
  getAppointmentAnimalIds,
  getAppointmentClientId,
  getAppointmentPropertyId,
  normalizeAppointmentForAnalysis,
  normalizeObjectValue
} from '../lib/appointments';

const TYPES = {
  clinico: { label: 'Clínico', color: 'bg-blue-100 text-blue-700' },
  reprodutivo: { label: 'Reprodutivo', color: 'bg-pink-100 text-pink-700' },
  cirurgico: { label: 'Cirúrgico', color: 'bg-red-100 text-red-700' },
  sanitario: { label: 'Sanitário', color: 'bg-green-100 text-green-700' },
  preventivo: { label: 'Preventivo', color: 'bg-purple-100 text-purple-700' },
  consultoria: { label: 'Consultoria', color: 'bg-cyan-100 text-cyan-700' }
};

const STATUS = {
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-700' },
  faturado: { label: 'Faturado', color: 'bg-purple-100 text-purple-700' }
};

import { offlineFetch, enqueueMutation, getPendingMutations, formatSyncErrorForUser, authFetch, getApiBaseUrl } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';

export default function AppointmentDetail() {
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPostCreateDialog, setShowPostCreateDialog] = useState(false);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [includePixInReport, setIncludePixInReport] = useState(false);
  const [showPrescriptionOptions, setShowPrescriptionOptions] = useState(false);
  const [includePrescriptionInReport, setIncludePrescriptionInReport] = useState(false);
  const [showReproductiveOptions, setShowReproductiveOptions] = useState(false);
  const [includeReproductiveInReport, setIncludeReproductiveInReport] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const urlParams = new URLSearchParams(window.location.search);
  const appointmentId = urlParams.get('id');
  const autoAction = urlParams.get('action');

  const normalizeAppointmentForUI = (rawAppointment) => {
    const base = normalizeAppointmentForAnalysis(rawAppointment) || {};
    return {
      ...base,
      symptoms: base.symptoms ?? '',
      diagnosis: base.diagnosis ?? '',
      observations: base.observations ?? '',
      procedures: Array.isArray(base.procedures) ? base.procedures : [],
      medications: Array.isArray(base.medications) ? base.medications : [],
      photos: Array.isArray(base.photos) ? base.photos : [],
      reproductive_data: normalizeObjectValue(base.reproductive_data),
      andrological_data: normalizeObjectValue(base.andrological_data),
      consultoria_data: normalizeObjectValue(base.consultoria_data),
    };
  };

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const mergeLatestPendingUpdate = (baseAppointment) => {
        const pendingUpdates = (getPendingMutations() || [])
          .filter((item) => item?.method === 'PUT' && String(item?.url || '').startsWith('/api/appointments/'))
          .filter((item) => {
            const itemId = String(item?.url || '').split('/').pop();
            return compareIds(itemId, appointmentId);
          });
        if (pendingUpdates.length === 0) return baseAppointment;
        const latestPending = pendingUpdates[pendingUpdates.length - 1];
        return {
          ...baseAppointment,
          ...(latestPending?.body || {}),
          isPending: true
        };
      };

      try {
        const fetched = await offlineFetch(`/api/appointments/${appointmentId}`);
        return normalizeAppointmentForUI(mergeLatestPendingUpdate(fetched));
      } catch (error) {
        const pending = (getPendingMutations() || []).find(
          (item) =>
            item?.method === 'POST' &&
            item?.url?.includes('/api/appointments') &&
            String(item?.id || '') === String(appointmentId || '')
        );

        if (pending?.body) {
          return normalizeAppointmentForUI({
            ...pending.body,
            id: pending.id,
            isPending: true
          });
        }

        try {
          const email = user?.email;
          const isAdmin = email === 'admin@duovet.app';
          const url = `/api/appointments?created_by=${isAdmin ? '' : (email || '')}`;
          const list = await offlineFetch(url);
          if (Array.isArray(list)) {
            const found = list.find((item) => compareIds(item?.id || item?._id, appointmentId));
            if (found) return normalizeAppointmentForUI(found);
          }
        } catch {}

        throw error;
      }
    },
    enabled: !!appointmentId
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: animals = [] } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/animals' : `/api/animals?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: lots = [] } = useQuery({
    queryKey: ['lots', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/lots' : `/api/lots?created_by=${email || ''}`;
      return offlineFetch(url);
      return offlineFetch(url);
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

  const { data: rawVetProfile } = useQuery({
    queryKey: ['vetProfile', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = `/api/vetprofiles?created_by=${isAdmin ? '' : (email || '')}`;
      const profiles = await offlineFetch(url);
      return Array.isArray(profiles) ? profiles[0] : null;
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

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/payments' : `/api/payments?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  // Compute derived data
  const appointmentClientId = getAppointmentClientId(appointment);
  const appointmentPropertyId = getAppointmentPropertyId(appointment);
  const client = (clients || []).find(c => c && compareIds(c.id || c._id, appointmentClientId));
  const property = (properties || []).find(p => p && compareIds(p.id || p._id, appointmentPropertyId));
  const appointmentAnimalIds = getAppointmentAnimalIds(appointment);
  const appointmentAnimals = (animals || []).filter(a => a && appointmentAnimalIds.some(aid => compareIds(aid, a.id || a._id)));
  const lot = (lots || []).find(l => l && compareIds(l.id || l._id, appointment?.lot_id));
  const typeInfo = TYPES[appointment?.type] || TYPES.clinico;
  const statusInfo = STATUS[appointment?.status] || STATUS.em_andamento;
  const appointmentIdentifier = String(appointment?.id || appointment?._id || appointmentId || '');
  const appointmentShortCode = appointmentIdentifier.slice(-6);
  const appointmentDate = appointment?.date ? new Date(appointment.date) : null;
  const appointmentDateLabel = appointmentDate && !Number.isNaN(appointmentDate.getTime())
    ? format(appointmentDate, "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : '-';
  const appointmentPayment = (payments || []).find((payment) =>
    payment && compareIds(payment.appointment_id, appointment?.id || appointment?._id)
  );
  const isPaymentPaid = appointmentPayment?.status === 'pago';
  const computedProceduresTotal = Array.isArray(appointment?.procedures)
    ? appointment.procedures.reduce((sum, procedure) => sum + parseMonetaryValue(procedure?.value), 0)
    : 0;
  const computedMedicationsTotal = Array.isArray(appointment?.medications)
    ? appointment.medications.reduce((sum, medication) => {
        const unitPrice = parseMonetaryValue(medication?.price ?? medication?.value);
        const quantity = parseMonetaryValue(medication?.quantity);
        const safeQuantity = quantity > 0 ? quantity : 1;
        return sum + (unitPrice * safeQuantity);
      }, 0)
    : 0;
  const storedProceduresTotal = parseMonetaryValue(appointment?.total_procedures);
  const storedMedicationsTotal = parseMonetaryValue(appointment?.total_medications);
  const displacementCostValue = parseMonetaryValue(appointment?.displacement_cost);
  const resolvedProceduresTotal = computedProceduresTotal > 0 ? computedProceduresTotal : storedProceduresTotal;
  const resolvedMedicationsTotal = computedMedicationsTotal > 0 ? computedMedicationsTotal : storedMedicationsTotal;
  const storedTotalAmount = parseMonetaryValue(appointment?.total_amount);
  const resolvedTotalAmount =
    storedTotalAmount > 0
      ? storedTotalAmount
      : (resolvedProceduresTotal + resolvedMedicationsTotal + displacementCostValue);

  const getSpecies = () => {
    if (appointment?.lot_id) {
      const lot = (lots || []).find(l => l && compareIds(l.id || l._id, appointment.lot_id));
      return lot?.species || 'bovino';
    }
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

  useEffect(() => {
    if (!appointment || autoAction !== 'generatePDF') return;
    setTimeout(() => handleGeneratePDF(), 500);
    window.history.replaceState({}, '', createPageUrl('AppointmentDetail') + `?id=${appointmentId}`);
  }, [appointment, autoAction]);

  useEffect(() => {
    if (!appointment || autoAction !== 'confirmCreation') return;
    setShowPostCreateDialog(true);
    window.history.replaceState({}, '', createPageUrl('AppointmentDetail') + `?id=${appointmentId}`);
  }, [appointment, autoAction, appointmentId]);

  useEffect(() => {
    if (!appointment || !client?.phone || autoAction !== 'sendWhatsApp') return;
    setTimeout(() => handleSendViaWhatsApp(), 500);
    window.history.replaceState({}, '', createPageUrl('AppointmentDetail') + `?id=${appointmentId}`);
  }, [appointment, client, autoAction]);

  const lastUpdateRef = React.useRef(null);

  const updateAppointmentMutation = useMutation({
    mutationFn: async () => {
      const data = lastUpdateRef.current || {};
      if (!appointment || !data || Object.keys(data).length === 0) {
        throw new Error('Atendimento não encontrado para atualização');
      }
      const payload = { ...appointment, ...data };
      delete payload.id;
      delete payload._id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.client;
      delete payload.property;
      delete payload.animals;
      delete payload.lot;
      delete payload.isPending;
      const cleanedPayload = deepClean(payload) || {};
      return enqueueMutation(`/api/appointments/${appointmentId}`, { method: 'PUT', body: cleanedPayload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Atendimento atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error(formatSyncErrorForUser(error));
    }
  });

  const finalizeMutation = useMutation({
    mutationFn: () => enqueueMutation(`/api/appointments/${appointmentId}/finalize`, { method: 'POST' }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['movements', user?.email] });
      toast.success(res?.queued ? 'Finalização enfileirada para sincronização' : 'Atendimento finalizado com sucesso!');
      setShowFinalizeDialog(false);
      window.location.href = createPageUrl('Appointments');
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: () => enqueueMutation(`/api/appointments/${appointmentId}`, { method: 'DELETE' }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['payments', user?.email] });
      toast.success(res?.queued ? 'Exclusão enfileirada para sincronização' : 'Atendimento excluído com sucesso!');
      setShowDeleteDialog(false);
      window.location.href = createPageUrl('Appointments');
    },
    onError: (error) => {
      toast.error(formatSyncErrorForUser(error));
    }
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        appointment_id: appointmentId,
        client_id: appointmentClientId,
        animal_ids: appointmentAnimalIds,
        date: new Date().toISOString().split('T')[0],
        medications: appointment.medications,
        observations: appointment.observations,
        created_by: user?.email
      };
      return enqueueMutation('/api/prescriptions', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['products', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['movements', user?.email] });
      toast.success(res?.queued ? 'Prescrição enfileirada para sincronização' : 'Prescrição gerada com sucesso!');
      window.location.href = createPageUrl('Prescriptions');
    }
  });

  const createReproductiveDataMutation = useMutation({
    mutationFn: async () => {
      if (appointmentAnimalIds.length === 0) {
        throw new Error('Nenhum animal vinculado ao atendimento');
      }

      const createdData = [];
      for (const animalId of appointmentAnimalIds) {
        const animal = (appointmentAnimals || []).find(a => a && compareIds(a.id || a._id, animalId));
        
        if (animal?.sex === 'macho' && appointment.andrological_data?.volume) {
          const payload = {
            animal_id: animalId,
            appointment_id: appointmentId,
            date: appointment.date,
            volume: appointment.andrological_data.volume || '',
            motility: appointment.andrological_data.motility || '',
            vigor: appointment.andrological_data.vigor || '',
            concentration_ml: appointment.andrological_data.concentration_ml || '',
            total_concentration: appointment.andrological_data.total_concentration || '',
            observations: appointment.andrological_data.observations || '',
            created_by: user?.email
          };
          createdData.push(enqueueMutation('/api/andrological-data', { method: 'POST', body: payload }));
        } else if (animal?.sex === 'femea' && (appointment.reproductive_data?.cervix || appointment.reproductive_data?.ut || appointment.reproductive_data?.oe || appointment.reproductive_data?.od || appointment.reproductive_data?.observations)) {
          const payload = {
            animal_id: animalId,
            appointment_id: appointmentId,
            date: appointment.date,
            cervix: appointment.reproductive_data?.cervix || '',
            ut: appointment.reproductive_data?.ut || '',
            oe: appointment.reproductive_data?.oe || '',
            od: appointment.reproductive_data?.od || '',
            observations: appointment.reproductive_data?.observations || '',
            created_by: user?.email
          };
          createdData.push(enqueueMutation('/api/reproductive-data', { method: 'POST', body: payload }));
        }
      }
      return Promise.all(createdData);
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['reproductiveData'] });
      await queryClient.invalidateQueries({ queryKey: ['andrologicalData'] });
      const someQueued = res.some(r => r?.queued);
      toast.success(someQueued ? 'Dados reprodutivos enfileirados para sincronização' : 'Dados reprodutivos registrados!');
    }
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async (nextPaidStatus) => {
      const totalAmount = Number(resolvedTotalAmount || 0);
      const today = new Date().toISOString().split('T')[0];
      if (appointmentPayment?.id) {
        return enqueueMutation(`/api/payments/${appointmentPayment.id}`, {
          method: 'PUT',
          body: {
            status: nextPaidStatus ? 'pago' : 'pendente',
            amount: Number(appointmentPayment.amount || totalAmount),
            amount_paid: nextPaidStatus ? Number(appointmentPayment.amount || totalAmount) : 0,
            payment_date: nextPaidStatus ? today : null,
            due_date: appointmentPayment.due_date || appointment?.date || today,
            created_by: user?.email
          }
        });
      }
      return enqueueMutation('/api/payments', {
        method: 'POST',
        body: {
          appointment_id: appointment?.id || appointment?._id,
          client_id: appointmentClientId,
          amount: totalAmount,
          amount_paid: nextPaidStatus ? totalAmount : 0,
          status: nextPaidStatus ? 'pago' : 'pendente',
          payment_date: nextPaidStatus ? today : null,
          due_date: appointment?.date || today,
          created_by: user?.email
        }
      });
    },
    onSuccess: async (res, nextPaidStatus) => {
      await queryClient.invalidateQueries({ queryKey: ['payments', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ['appointments', user?.email] });
      toast.success(res?.queued
        ? `Atualização de pagamento enfileirada (${nextPaidStatus ? 'Pago' : 'Pendente'})`
        : `Pagamento marcado como ${nextPaidStatus ? 'Pago' : 'Pendente'}`);
    },
    onError: (error) => {
      toast.error(formatSyncErrorForUser(error));
    }
  });

  const handleGeneratePDF = () => {
    // Check if has reproductive data first (gynecological or andrological)
    const hasReproductiveData = appointment.type === 'reprodutivo' && (
      appointment.reproductive_data?.cervix || 
      appointment.andrological_data?.volume
    );
    
    if (hasReproductiveData) {
      setShowReproductiveOptions(true);
    } else if (appointment.medications?.length > 0) {
      setShowPrescriptionOptions(true);
    } else if (vetProfile?.pix_key) {
      setShowPixDialog(true);
    } else {
      generatePDF(false, false, false);
    }
  };
  

  const handleReproductiveChoice = () => {
    setShowReproductiveOptions(false);
    
    // Save reproductive data if checkbox is checked
    if (includeReproductiveInReport && appointment.type === 'reprodutivo') {
      createReproductiveDataMutation.mutate();
    }

    // Then check for prescription
    if (appointment.medications?.length > 0) {
      setShowPrescriptionOptions(true);
    } else if (vetProfile?.pix_key) {
      setShowPixDialog(true);
    } else {
      generatePDF(false, false, includeReproductiveInReport);
    }
  };

  const handlePrescriptionChoice = () => {
    setShowPrescriptionOptions(false);
    if (vetProfile?.pix_key) {
      setShowPixDialog(true);
    } else {
      generatePDF(false, includePrescriptionInReport, includeReproductiveInReport);
    }
  };

  const handleDownloadPrescription = async () => {
    try {
      await generatePrescriptionPDF(appointment, client, appointmentAnimals, vetProfile);
      toast.success('Prescrição baixada com sucesso!');
    } catch (e) {
      console.error('Erro ao gerar prescrição PDF:', e);
      toast.error('Erro ao gerar PDF da prescrição');
    }
  };

  const handleGenerateAuthorizationTerm = async () => {
    await generateAuthorizationTermPDF(appointment, client, property, appointmentAnimals, lot, vetProfile);
    toast.success('Termo de autorização gerado com sucesso!');
  };

  const handleTogglePaymentStatus = () => {
    updatePaymentStatusMutation.mutate(!isPaymentPaid);
  };

  const handleSendViaWhatsApp = async () => {
    if (!client?.phone) {
      toast.error('Cliente não possui número de WhatsApp cadastrado');
      return;
    }

    if (!isValidWhatsAppNumber(client.phone)) {
      toast.error('Número de WhatsApp inválido. Verifique o cadastro do cliente.');
      return;
    }

    const hasReproductiveData = appointment?.type === 'reprodutivo' && (
      appointment?.reproductive_data?.cervix ||
      appointment?.andrological_data?.volume
    );

    const includeReproductive = Boolean(hasReproductiveData);
    const includePrescription = Boolean(appointment?.medications?.length > 0);

    const loadingToast = toast.loading('Gerando relatório PDF...');
    try {
      const pdfBlob = await generatePDF(false, includePrescription, includeReproductive, { output: 'blob' });
      const fileName = `atendimento_${appointmentShortCode || 'relatorio'}.pdf`;
      const reportFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const shareText = [
        `Olá ${client?.name || 'Cliente'}! 👋`,
        '',
        `Segue o relatório do atendimento${appointmentDateLabel && appointmentDateLabel !== '-' ? ` em ${appointmentDateLabel}` : ''}.`,
        '',
        'Qualquer dúvida, fico à disposição! 🩺'
      ].join('\n');

      // Preferir compartilhamento real de arquivo no mobile (permite escolher WhatsApp e anexar o PDF).
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [reportFile] })
      ) {
        await navigator.share({
          title: 'Relatório de Atendimento',
          text: shareText,
          files: [reportFile]
        });
        toast.success('Relatório pronto para envio no WhatsApp');
        return;
      }

      const formData = new FormData();
      formData.append('file', reportFile, fileName);

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

      const clientName = client?.name || 'Cliente';
      const header = `Olá ${clientName}! 👋`;
      const when = appointmentDateLabel && appointmentDateLabel !== '-' ? ` em ${appointmentDateLabel}` : '';
      const animalsText = appointmentAnimals?.length
        ? `\n\n🐾 Animal(is): ${appointmentAnimals.map((a) => a?.name).filter(Boolean).join(', ')}`
        : '';
      const msg = [
        header,
        '',
        `Segue o relatório do atendimento${when}.`,
        animalsText ? animalsText.trim() : '',
        '',
        '📄 *Baixar Relatório PDF:*',
        pdfUrl,
        '',
        'Qualquer dúvida, fico à disposição! 🩺'
      ].filter(Boolean).join('\n');

      const opened = openWhatsApp(client.phone, msg);
      if (!opened) {
        throw new Error('Não foi possível montar o link do WhatsApp');
      }
      toast.success('WhatsApp aberto com link do relatório');
    } catch (e) {
      if (e?.name === 'AbortError') {
        toast.message('Compartilhamento cancelado');
        return;
      }
      console.error('Erro ao enviar relatório por WhatsApp:', e);
      toast.error('Erro ao preparar relatório para WhatsApp');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  const resolveAppointmentPhotoUrl = (photo) => photo?.url || photo?.file_url || photo?.photo_url || '';

  const loadImageForPdf = async (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith('data:image/')) return url;
    if (url.startsWith('blob:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return blobToDataUrl(blob);
    }
    // offlineFetch com responseType 'blob' já retorna um data URL
    const result = await offlineFetch(url, { responseType: 'blob' });
    return result && typeof result === 'string' && result.startsWith('data:image/') ? result : await blobToDataUrl(result);
  };

  const getImageFormat = (dataUrl) => {
    const header = String(dataUrl || '').slice(0, 40).toLowerCase();
    if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'JPEG';
    return 'PNG';
  };

  const generatePDF = async (includePix = false, includePrescription = false, includeReproductive = false, options = {}) => {
    setShowPixDialog(false);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Professional Header
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, pageWidth, 4, 'F');
    
    // Vet Logo placeholder (if exists)
    if (vetProfile?.logo_url) {
      try {
        const logoData = await loadImageForPdf(vetProfile.logo_url);
        if (logoData) {
          doc.addImage(logoData, getImageFormat(logoData), 15, 10, 25, 25);
        }
      } catch (e) {
        // If logo fails, continue without it
      }
    }
    
    // Vet Info Header
    const headerX = vetProfile?.logo_url ? 45 : 15;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(vetProfile?.full_name || vetProfile?.fantasy_name || 'DuoVet', headerX, 18);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    if (vetProfile?.crmv) {
      doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, headerX, 25);
    }
    if (vetProfile?.phone) {
      doc.text(`Tel: ${vetProfile.phone}`, headerX, 30);
    }
    if (vetProfile?.email) {
      doc.text(`E-mail: ${vetProfile.email}`, headerX, 35);
    }
    if (vetProfile?.city || vetProfile?.state) {
      const location = `${vetProfile?.city || ''}${vetProfile?.city && vetProfile?.state ? ' - ' : ''}${vetProfile?.state || ''}`.trim();
      if (location) {
        doc.text(location, headerX, 40);
      }
    }
    
    // Document Title - Right aligned
    const reportTitleByType = {
      consultoria: 'RELATÓRIO DE CONSULTORIA',
      clinico: 'RELATÓRIO CLÍNICO',
      reprodutivo: 'RELATÓRIO REPRODUTIVO'
    };
    const reportTitle = reportTitleByType[appointment.type] || 'RELATÓRIO DE ATENDIMENTO';

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(reportTitle, pageWidth - 15, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Documento Nº ${String(appointment?.id || '').slice(-8).toUpperCase() || 'N/A'}`, pageWidth - 15, 27, { align: 'right' });
    doc.text(`Data: ${safeFormatDate(appointment.date, "dd/MM/yyyy 'às' HH:mm")}`, pageWidth - 15, 32, { align: 'right' });
    
    // Separator line
    let y = 52;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 12;
    
    // Two Column Layout - Identification Section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('IDENTIFICAÇÃO', 15, y);
    y += 8;
    
    // Left Column - Client & Property
    const colWidth = (pageWidth - 40) / 2;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('CLIENTE', 15, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(client?.name || '-', 15, y);
    y += 4;
    if (client?.document) {
      doc.setTextColor(100, 100, 100);
      doc.text(`CPF/CNPJ: ${client.document}`, 15, y);
      y += 4;
    }
    if (client?.phone) {
      doc.text(`Tel: ${client.phone}`, 15, y);
      y += 4;
    }
    
    // Right Column - Appointment Details
    let yRight = 72;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('ATENDIMENTO', 15 + colWidth, yRight);
    yRight += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(`Data: ${safeFormatDate(appointment.date, "dd/MM/yyyy 'às' HH:mm")}`, 15 + colWidth, yRight);
    yRight += 4;
    doc.text(`Tipo: ${typeInfo.label}`, 15 + colWidth, yRight);
    yRight += 4;
    if (property) {
      doc.text(`Propriedade: ${property.name}`, 15 + colWidth, yRight);
      yRight += 4;
      if (property.city && property.state) {
        doc.text(`Local: ${property.city} - ${property.state}`, 15 + colWidth, yRight);
        yRight += 4;
      }
    }
    
    y = Math.max(y, yRight) + 8;
    
    // Animals Section
    if (lot || appointmentAnimals.length > 0) {
      doc.setDrawColor(240, 240, 240);
      doc.setFillColor(250, 250, 250);
      
      const itemCount = lot ? 1 : appointmentAnimals.length;
      doc.rect(15, y, pageWidth - 30, 5 + (itemCount * 5), 'FD');
      y += 4;
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(lot ? 'LOTE ATENDIDO' : 'ANIMAIS ATENDIDOS', 18, y);
      y += 5;
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
      
      if (lot) {
        const lotInfo = `${lot.name} • ${lot.species} • ${lot.quantity} cabeças`;
        doc.text(lotInfo, 18, y);
        y += 5;
      } else {
        appointmentAnimals.forEach(animal => {
          const animalInfo = `${animal.name} • ${animal.species}${animal.breed ? ' • ' + animal.breed : ''}${animal.identification ? ' • ID: ' + animal.identification : ''}`;
          doc.text(animalInfo, 18, y);
          y += 5;
        });
      }
      y += 8;
    }
    
    // Clinical Content Section
    const hasClinicalContent = appointment.type === 'clinico' && (appointment.symptoms || appointment.diagnosis);
    const hasConsultoriaContent = appointment.type === 'consultoria' && appointment.consultoria_data?.description;
    if (hasClinicalContent || hasConsultoriaContent) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(appointment.type === 'consultoria' ? 'RELATÓRIO TÉCNICO' : 'AVALIAÇÃO CLÍNICA', 15, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
      
      if (hasConsultoriaContent) {
        const descLines = doc.splitTextToSize(appointment.consultoria_data.description, pageWidth - 30);
        doc.text(descLines, 15, y);
        y += descLines.length * 5 + 5;
      }
      
      if (appointment.type === 'clinico' && appointment.symptoms) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Sintomas Apresentados:', 15, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const symptomLines = doc.splitTextToSize(appointment.symptoms, pageWidth - 30);
        doc.text(symptomLines, 15, y);
        y += symptomLines.length * 5 + 5;
      }
      
      if (appointment.type === 'clinico' && appointment.diagnosis) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Diagnóstico:', 15, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const diagnosisLines = doc.splitTextToSize(appointment.diagnosis, pageWidth - 30);
        doc.text(diagnosisLines, 15, y);
        y += diagnosisLines.length * 5 + 5;
      }
      
      y += 3;
    }
    
    // Procedures Section
    if (appointment.procedures?.length > 0) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('PROCEDIMENTOS REALIZADOS', 15, y);
      y += 8;
      
      // Table-like structure
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      
      appointment.procedures.forEach((proc, idx) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = 20;
        }
        
        // Alternate row colors
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
        }
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(proc.name, 18, y);
        doc.text(`R$ ${proc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 18, y, { align: 'right' });
        y += 8;
      });
      y += 5;
    }
    
    // Gynecological Data Section (Females)
    if (includeReproductive && appointment.type === 'reprodutivo' && appointment.reproductive_data?.cervix) {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('EXAME GINECOLÓGICO', 15, y);
      y += 8;

      const repData = appointment.reproductive_data;
      const repFields = [
        { label: 'Cérvix', value: repData.cervix },
        { label: 'Útero (UT)', value: repData.ut },
        { label: 'Ovário Esquerdo (OE)', value: repData.oe },
        { label: 'Ovário Direito (OD)', value: repData.od }
      ];

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      repFields.forEach(field => {
        if (field.value) {
          doc.setFont(undefined, 'bold');
          doc.setTextColor(100, 100, 100);
          doc.text(`${field.label}:`, 15, y);
          y += 4;
          doc.setFont(undefined, 'normal');
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(field.value, pageWidth - 30);
          doc.text(lines, 15, y);
          y += lines.length * 4 + 2;
        }
      });

      if (repData.observations) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Observações:', 15, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const obsLines = doc.splitTextToSize(repData.observations, pageWidth - 30);
        doc.text(obsLines, 15, y);
        y += obsLines.length * 4 + 5;
      }

      y += 3;
    }

    // Andrological Data Section (Males)
    if (includeReproductive && appointment.type === 'reprodutivo' && appointment.andrological_data?.volume) {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('EXAME ANDROLÓGICO', 15, y);
      y += 8;

      const androData = appointment.andrological_data;
      const androFields = [
        { label: 'Volume', value: androData.volume },
        { label: 'Motilidade', value: androData.motility },
        { label: 'Vigor', value: androData.vigor },
        { label: 'Concentração/mL', value: androData.concentration_ml },
        { label: 'Concentração Total', value: androData.total_concentration }
      ];

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      androFields.forEach(field => {
        if (field.value) {
          doc.setFont(undefined, 'bold');
          doc.setTextColor(100, 100, 100);
          doc.text(`${field.label}:`, 15, y);
          y += 4;
          doc.setFont(undefined, 'normal');
          doc.setTextColor(40, 40, 40);
          const lines = doc.splitTextToSize(field.value, pageWidth - 30);
          doc.text(lines, 15, y);
          y += lines.length * 4 + 2;
        }
      });

      if (androData.observations) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('Observações:', 15, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(40, 40, 40);
        const obsLines = doc.splitTextToSize(androData.observations, pageWidth - 30);
        doc.text(obsLines, 15, y);
        y += obsLines.length * 4 + 5;
      }

      y += 3;
    }

    // Medications - Only basic list if not including full prescription
    if (appointment.medications?.length > 0 && !includePrescription) {
      doc.setFont(undefined, 'bold');
      doc.text('MEDICAMENTOS', 15, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      appointment.medications.forEach(med => {
        const quantity = Number(med?.quantity) || 1;
        const unitValue = Number(med?.price ?? med?.value) || 0;
        const totalValue = quantity * unitValue;
        const valueText = unitValue > 0
          ? ` | Valor: R$ ${unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : '';
        const medLine = `• ${med.name} - ${med.dosage || ''} (Qtd: ${quantity})${valueText}`;
        const medLines = doc.splitTextToSize(medLine, pageWidth - 30);
        doc.text(medLines, 15, y);
        y += (medLines.length * 4) + 1;
      });
      y += 5;
    }
    
    // Professional Prescription Table
    if (includePrescription && appointment.medications?.length > 0) {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('PRESCRIÇÃO MEDICAMENTOSA', 15, y);
      y += 8;
      
      appointment.medications.forEach((med, index) => {
        if (y > pageHeight - 50) {
          doc.addPage();
          y = 20;
        }
        
        // Medication box
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(250, 252, 255);
        const boxHeight = 25 + (med.instructions ? 10 : 0);
        doc.roundedRect(15, y - 3, pageWidth - 30, boxHeight, 2, 2, 'FD');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(34, 197, 94);
        doc.text(`${index + 1}.`, 18, y + 2);
        doc.setTextColor(40, 40, 40);
        doc.text(med.name, 25, y + 2);
        
        y += 7;
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        
        if (med.active_ingredient) {
          doc.text(`Princípio Ativo: ${med.active_ingredient}`, 18, y);
          y += 4;
        }
        
        const prescDetails = [];
        if (med.dosage) prescDetails.push(`Dosagem: ${med.dosage}`);
        if (med.administration_route) prescDetails.push(`Via: ${med.administration_route}`);
        if (prescDetails.length > 0) {
          doc.text(prescDetails.join(' • '), 18, y);
          y += 4;
        }
        
        const timeDetails = [];
        if (med.frequency) timeDetails.push(`${med.frequency}`);
        if (med.duration) timeDetails.push(`por ${med.duration}`);
        if (timeDetails.length > 0) {
          doc.text(timeDetails.join(' '), 18, y);
          y += 4;
        }
        
        if (med.instructions) {
          doc.setFont(undefined, 'italic');
          doc.setTextColor(60, 60, 60);
          const instrLines = doc.splitTextToSize(`Instruções: ${med.instructions}`, pageWidth - 40);
          doc.text(instrLines, 18, y);
          y += instrLines.length * 4;
        }
        
        y += boxHeight - 18;
      });
      
      y += 8;
    }
    
    // Photo Gallery in Grid
    const photosToInclude = appointment.photos?.filter(p => p.include_in_report) || [];
    if (photosToInclude.length > 0) {
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('REGISTRO FOTOGRÁFICO', 15, y);
      y += 10;
      
      const imgWidth = 60;
      const imgHeight = 45;
      const spacing = 5;
      const imagesPerRow = 2;
      let currentCol = 0;
      let rowStartY = y;
      
      for (let i = 0; i < photosToInclude.length; i++) {
        const photo = photosToInclude[i];
        try {
          const photoUrl = resolveAppointmentPhotoUrl(photo);
          const imgData = await loadImageForPdf(photoUrl);
          if (!imgData) continue;
          
          if (y > pageHeight - imgHeight - 30 && currentCol === 0) {
            doc.addPage();
            y = 20;
            rowStartY = y;
          }
          
          const xPos = 15 + (currentCol * (imgWidth + spacing + 5));
          
          // Image border
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.rect(xPos, y, imgWidth, imgHeight);
          const imageType = String(photoUrl || '').toLowerCase().includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(imgData, imageType, xPos + 1, y + 1, imgWidth - 2, imgHeight - 2);
          
          // Caption
          if (photo.caption) {
            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            const captionLines = doc.splitTextToSize(photo.caption, imgWidth - 4);
            doc.text(captionLines, xPos + 2, y + imgHeight + 4);
          }
          
          currentCol++;
          if (currentCol >= imagesPerRow) {
            currentCol = 0;
            y = rowStartY + imgHeight + (photo.caption ? 12 : 8);
            rowStartY = y;
          }
        } catch (error) {
          console.error('Erro ao adicionar foto ao PDF:', error);
        }
      }
      
      if (currentCol > 0) {
        y = rowStartY + imgHeight + 12;
      }
      y += 5;
    }
    
    // Recommendations Section
    if (appointment.consultoria_data?.technical_notes || appointment.observations) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('RECOMENDAÇÕES E OBSERVAÇÕES', 15, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
      const notes = appointment.consultoria_data?.technical_notes || appointment.observations;
      const noteLines = doc.splitTextToSize(notes, pageWidth - 30);
      doc.text(noteLines, 15, y);
      y += noteLines.length * 5 + 10;
    }
    
    // Financial Summary (Optional - simplified)
    if (resolvedTotalAmount > 0) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      
      doc.setDrawColor(220, 220, 220);
      doc.line(15, y, pageWidth - 15, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('RESUMO FINANCEIRO', 15, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      
      if (resolvedProceduresTotal > 0) {
        doc.text('Procedimentos', 15, y);
        doc.text(`R$ ${formatMoney(resolvedProceduresTotal)}`, pageWidth - 15, y, { align: 'right' });
        y += 5;
      }
      
      if (resolvedMedicationsTotal > 0) {
        doc.text('Medicamentos', 15, y);
        doc.text(`R$ ${formatMoney(resolvedMedicationsTotal)}`, pageWidth - 15, y, { align: 'right' });
        y += 5;
      }
      
      if (displacementCostValue > 0) {
        doc.text('Deslocamento', 15, y);
        doc.text(`R$ ${formatMoney(displacementCostValue)}`, pageWidth - 15, y, { align: 'right' });
        y += 5;
      }
      
      y += 2;
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('VALOR TOTAL', 15, y);
      doc.text(`R$ ${formatMoney(resolvedTotalAmount)}`, pageWidth - 15, y, { align: 'right' });
      y += 10;
    }
    
    // Signature Section
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    } else {
      y = pageHeight - 50;
    }
    
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('ASSINATURA DO VETERINÁRIO RESPONSÁVEL', 15, y);
    y += 2;
    
    // Signature
    const vetSignatureSource = vetProfile?.signature_url || vetProfile?.signature;
    if (vetSignatureSource) {
      try {
        const sigData = await loadImageForPdf(vetSignatureSource);
        if (sigData) {
          doc.addImage(sigData, getImageFormat(sigData), 15, y, 40, 15);
          y += 18;
        } else {
          doc.setDrawColor(180, 180, 180);
          doc.line(15, y + 10, 80, y + 10);
          y += 13;
        }
      } catch (e) {
        doc.setDrawColor(180, 180, 180);
        doc.line(15, y + 10, 80, y + 10);
        y += 13;
      }
    } else {
      doc.setDrawColor(180, 180, 180);
      doc.line(15, y + 10, 80, y + 10);
      y += 13;
    }
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(vetProfile?.full_name || 'Veterinário Responsável', 15, y);
    y += 4;
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    if (vetProfile?.crmv) {
      doc.text(`CRMV ${vetProfile.crmv}${vetProfile.crmv_state ? ' - ' + vetProfile.crmv_state : ''}`, 15, y);
    }
    
    // Footer info
    const footerY = pageHeight - 15;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} via DuoVet`, 15, footerY);
    
    // Pix Key in Footer (if requested)
    if (includePix && vetProfile?.pix_key) {
      doc.setFontSize(8);
      doc.setTextColor(34, 197, 94);
      doc.setFont(undefined, 'bold');
      doc.text('Chave Pix:', pageWidth - 15, footerY - 8, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.text(vetProfile.pix_key, pageWidth - 15, footerY - 3, { align: 'right' });
    }
    
    const outputMode = options?.output || 'download';
    if (outputMode === 'bloburl') {
      // Download compatível com mobile
      const blobUrl = doc.output('bloburl');
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `atendimento_${appointmentShortCode}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
      toast.success('PDF gerado com sucesso!');
      return;
    }

    doc.save(`atendimento_${appointmentShortCode}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a4d2e]"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Atendimento não encontrado</p>
        <Link to={createPageUrl('Appointments')}>
          <Button variant="link" className="mt-4">Voltar aos atendimentos</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
              <Badge className={isPaymentPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                {isPaymentPaid ? 'Pagamento: Pago' : 'Pagamento: Pendente'}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Atendimento #{appointmentShortCode}
            </h1>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:ml-auto sm:justify-end">
          {appointment.status === 'em_andamento' && (
            <>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="outline"
                className="border-red-200 text-red-600 hover:text-red-700 hover:border-red-300 rounded-xl h-11 px-4 sm:px-5 flex items-center justify-center gap-2"
                disabled={appointment.isPending}
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir</span>
              </Button>
              <Button 
                onClick={() => setShowFinalizeDialog(true)}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-xl h-11 px-4 sm:px-5 flex items-center justify-center"
              >
                <Check className="w-4 h-4" />
                <span>Finalizar</span>
              </Button>
            </>
          )}
          {appointment.status !== 'em_andamento' && (
            <Button 
              className="bg-[var(--bg-tertiary)] text-[var(--text-muted)] gap-2 rounded-xl h-11 px-4 sm:px-5 cursor-default flex items-center justify-center"
              disabled
            >
              Finalizado
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Basic Info */}
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--text-primary)]">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Data</p>
                    <p className="font-medium">
                      {appointmentDateLabel}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-medium">{client?.name || '-'}</p>
                  </div>
                </div>
                
                {property && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Propriedade</p>
                      <p className="font-medium">{property.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Lot or Animals */}
              {lot ? (
                <div>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                    <AnimalIcon 
                      species={getSpecies()} 
                      isLot={true} 
                      white={false}
                      className="w-4 h-4 text-[var(--accent)]" 
                    />
                    Lote Atendido
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-sm font-bold bg-[var(--bg-tertiary)] text-[var(--accent)] border-[var(--accent)]/20 px-3 py-1 rounded-xl">
                      {lot.name} • {lot.quantity} cabeças
                    </Badge>
                  </div>
                </div>
              ) : appointmentAnimals.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                    <AnimalIcon 
                      species={getSpecies()} 
                      white={false}
                      className="w-4 h-4 text-[var(--accent)]" 
                    />
                    Animal{appointmentAnimals.length > 1 ? 's' : ''} Atendido{appointmentAnimals.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {appointmentAnimals.map(animal => (
                      <Badge key={animal.id} variant="outline" className="py-1">
                        {animal.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinical Info */}
          {appointment.type === 'clinico' && (appointment.symptoms || appointment.diagnosis) && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[#1a4d2e]" />
                  Dados Clínicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {appointment.symptoms && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Sintomas</p>
                    <p className="text-gray-900 dark:text-slate-100">{appointment.symptoms}</p>
                  </div>
                )}
                {appointment.diagnosis && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Diagnóstico</p>
                    <p className="text-gray-900 dark:text-slate-100">{appointment.diagnosis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Procedures */}
          {appointment.procedures?.length > 0 && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Procedimentos Realizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {appointment.procedures.map((procedure, index) => (
                    <div key={index} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span>{procedure.name}</span>
                      <span className="font-medium">
                        R$ {(procedure.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gynecological Data Card - Females */}
          {appointment.type === 'reprodutivo' && appointment.reproductive_data?.cervix && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>🔬</span>
                  Exame Ginecológico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Protocol-specific data */}
                {(appointment.reproductive_data.protocol || appointment.reproductive_data.semen || appointment.reproductive_data.semen_bull || appointment.reproductive_data.pregnancy_result) && (
                  <div className="pb-4 border-b border-[var(--border-color)]">
                    {appointment.reproductive_data.protocol && (
                      <div className="mb-3">
                        <p className="text-sm text-[var(--text-muted)]">Protocolo</p>
                        <p className="text-[var(--text-primary)] font-medium">{appointment.reproductive_data.protocol}</p>
                      </div>
                    )}
                    {(appointment.reproductive_data.semen || appointment.reproductive_data.semen_bull) && (
                      <div className="mb-3">
                        <p className="text-sm text-[var(--text-muted)]">Sêmen</p>
                        <p className="text-[var(--text-primary)] font-medium">
                          {appointment.reproductive_data.semen || appointment.reproductive_data.semen_bull}
                        </p>
                      </div>
                    )}
                    {appointment.reproductive_data.semen_packaging && (
                      <div className="mb-3">
                        <p className="text-sm text-[var(--text-muted)]">Acondicionamento</p>
                        <p className="text-[var(--text-primary)] font-medium">
                          {appointment.reproductive_data.semen_packaging === 'congelado' && 'Congelado'}
                          {appointment.reproductive_data.semen_packaging === 'refrigerado' && 'Refrigerado'}
                          {appointment.reproductive_data.semen_packaging === 'fresco' && 'Fresco'}
                          {appointment.reproductive_data.semen_packaging === 'resfriado' && 'Fresco'}
                          {appointment.reproductive_data.semen_packaging === 'outro' && (appointment.reproductive_data.semen_packaging_other || 'Outro')}
                        </p>
                      </div>
                    )}
                    {appointment.reproductive_data.pregnancy_result && (
                      <div>
                        <p className="text-sm text-[var(--text-muted)]">Resultado</p>
                        <p className="text-[var(--text-primary)] font-medium">{appointment.reproductive_data.pregnancy_result}</p>
                      </div>
                    )}
                    {(appointment.reproductive_data.pregnancy_positive_count !== undefined && appointment.reproductive_data.pregnancy_positive_count !== null && appointment.reproductive_data.pregnancy_positive_count !== '') && (
                      <div>
                        <p className="text-sm text-[var(--text-muted)]">Positivos no Lote</p>
                        <p className="text-[var(--text-primary)] font-medium">
                          {appointment.reproductive_data.pregnancy_positive_count}
                          {(appointment.reproductive_data.pregnancy_positive_percentage !== undefined && appointment.reproductive_data.pregnancy_positive_percentage !== null && appointment.reproductive_data.pregnancy_positive_percentage !== '') && (
                            <span className="text-[var(--text-muted)] font-normal">
                              {' '}({Number(appointment.reproductive_data.pregnancy_positive_percentage).toFixed(2)}%)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Exam data */}
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">Avaliação Reprodutiva</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {appointment.reproductive_data.cervix && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Cérvix</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.reproductive_data.cervix}</p>
                      </div>
                    )}
                    {appointment.reproductive_data.ut && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Útero (UT)</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.reproductive_data.ut}</p>
                      </div>
                    )}
                    {appointment.reproductive_data.oe && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Ovário Esquerdo (OE)</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.reproductive_data.oe}</p>
                      </div>
                    )}
                    {appointment.reproductive_data.od && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Ovário Direito (OD)</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.reproductive_data.od}</p>
                      </div>
                    )}
                  </div>
                  {appointment.reproductive_data.observations && (
                    <div className="mt-3 bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Observações Adicionais</p>
                      <p className="text-sm text-[var(--text-primary)]">{appointment.reproductive_data.observations}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Andrological Data Card - Males */}
          {appointment.type === 'reprodutivo' && appointment.andrological_data?.volume && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>🧪</span>
                  Exame Andrológico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">Análise do Sêmen</h4>
                  <div className="grid md:grid-cols-3 gap-3">
                    {appointment.andrological_data.volume && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Volume</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.volume}</p>
                      </div>
                    )}
                    {appointment.andrological_data.motility && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Motilidade</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.motility}</p>
                      </div>
                    )}
                    {appointment.andrological_data.vigor && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Vigor</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.vigor}</p>
                      </div>
                    )}
                    {appointment.andrological_data.concentration_ml && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Concentração/mL</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.concentration_ml}</p>
                      </div>
                    )}
                    {appointment.andrological_data.total_concentration && (
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Concentração Total</p>
                        <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.total_concentration}</p>
                      </div>
                    )}
                  </div>
                  {appointment.andrological_data.observations && (
                    <div className="mt-3 bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-color)]">
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Observações</p>
                      <p className="text-sm text-[var(--text-primary)]">{appointment.andrological_data.observations}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prescription */}
          {appointment.medications?.length > 0 && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[var(--accent)]" />
                  Prescrição de Medicamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PrescriptionForm
                  medications={appointment.medications}
                onChange={(medications) => { lastUpdateRef.current = { medications }; updateAppointmentMutation.mutate(); }}
                  readonly={appointment.status === 'faturado'}
                />
              </CardContent>
            </Card>
          )}

          {/* Observations */}
          {appointment.observations && (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{appointment.observations}</p>
              </CardContent>
            </Card>
          )}

          {/* Photo Gallery */}
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-[var(--accent)]" />
                Registro Fotográfico
              </CardTitle>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Documente visualmente o atendimento. Clique no ✓ para incluir a foto no relatório.
              </p>
            </CardHeader>
            <CardContent>
              <PhotoGallery
                photos={appointment.photos || []}
                onChange={(photos) => { lastUpdateRef.current = { photos }; updateAppointmentMutation.mutate(); }}
                readonly={appointment.status === 'faturado'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#1a4d2e]" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Procedimentos</span>
                <span>R$ {formatMoney(resolvedProceduresTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Medicamentos</span>
                <span>R$ {formatMoney(resolvedMedicationsTotal)}</span>
              </div>
              {displacementCostValue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    Deslocamento
                  </span>
                  <span>R$ {formatMoney(displacementCostValue)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span className="text-[#1a4d2e]">Total</span>
                <span className="text-[#1a4d2e]">
                  R$ {formatMoney(resolvedTotalAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
           <CardHeader>
             <CardTitle className="text-lg text-[var(--text-primary)]">Ações</CardTitle>
           </CardHeader>
           <CardContent className="space-y-3">
             <Button 
               className="w-full gap-2 rounded-xl h-11 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
               variant="outline"
               onClick={handleGenerateAuthorizationTerm}
             >
               <FileText className="w-4 h-4" />
               Termo de Autorização
             </Button>

             {appointment.medications?.length > 0 && (
               <Button 
                 className="w-full gap-2 rounded-xl h-11 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
                 variant="outline"
                 onClick={handleDownloadPrescription}
               >
                 <Download className="w-4 h-4" />
                 Baixar Prescrição
               </Button>
             )}

             {appointment.status !== 'em_andamento' && (
               <>
                 <Button
                   className={`w-full gap-2 rounded-xl h-11 ${
                     isPaymentPaid
                       ? 'bg-amber-500 hover:bg-amber-600 text-white'
                       : 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
                   }`}
                   onClick={handleTogglePaymentStatus}
                   disabled={updatePaymentStatusMutation.isPending}
                 >
                   {isPaymentPaid ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                   {updatePaymentStatusMutation.isPending
                     ? 'Atualizando pagamento...'
                     : (isPaymentPaid ? 'Marcar como Pendente' : 'Marcar como Pago')}
                 </Button>

                 <Button 
                   className="w-full gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl h-11"
                   onClick={handleGeneratePDF}
                 >
                   <Download className="w-4 h-4" />
                   Baixar Relatório PDF
                 </Button>

                 <Button 
                   onClick={handleSendViaWhatsApp}
                   className="w-full gap-2 rounded-xl h-11"
                   variant="outline"
                   style={{ 
                     borderColor: '#25D366', 
                     color: '#25D366'
                   }}
                 >
                   <MessageCircle className="w-4 h-4" />
                   Enviar pelo WhatsApp
                 </Button>
               </>
             )}

             {appointment.status === 'finalizado' && (
               <Button 
                 className="w-full gap-2 rounded-xl h-11 text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]"
                 variant="outline"
                 onClick={() => window.location.href = createPageUrl('Invoices') + `?action=bill&appointmentId=${appointmentId}`}
               >
                 <Receipt className="w-4 h-4" />
                 Emitir Nota Fiscal
               </Button>
             )}
           </CardContent>
          </Card>
        </div>
      </div>

      {/* Prescription Options Dialog */}
      <Dialog open={showPrescriptionOptions} onOpenChange={setShowPrescriptionOptions}>
        <DialogContent className="rounded-2xl" aria-describedby="prescription-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Incluir Prescrição no Relatório?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4" id="prescription-dialog-description">
            <p className="text-sm text-[var(--text-muted)]">
              Este atendimento possui medicamentos prescritos. Deseja incluir a prescrição completa no relatório?
            </p>
            <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <Checkbox
                id="include-prescription"
                checked={includePrescriptionInReport}
                onCheckedChange={(checked) => { setIncludePrescriptionInReport(checked === true); }}
              />
              <Label htmlFor="include-prescription" className="font-medium cursor-pointer">
                Incluir prescrição detalhada de medicamentos no relatório
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handlePrescriptionChoice} 
              className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reproductive Data Options Dialog */}
      <Dialog open={showReproductiveOptions} onOpenChange={setShowReproductiveOptions}>
        <DialogContent className="rounded-2xl" aria-describedby="reproductive-dialog-description">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Incluir Dados Reprodutivos no Relatório?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4" id="reproductive-dialog-description">
            <p className="text-sm text-[var(--text-muted)]">
              Este atendimento contém dados reprodutivos. Deseja incluí-los no relatório PDF?
            </p>
            <div className="flex items-center gap-3 p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl">
              <Checkbox
                id="include-reproductive"
                checked={includeReproductiveInReport}
                onCheckedChange={(checked) => { setIncludeReproductiveInReport(checked === true); }}
              />
              <Label htmlFor="include-reproductive" className="font-medium cursor-pointer">
                {appointment.andrological_data?.volume 
                  ? 'Incluir dados do exame andrológico no relatório'
                  : 'Incluir dados do exame ginecológico no relatório'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleReproductiveChoice} 
              className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pix Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Incluir Chave Pix no Relatório?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[var(--text-muted)]">
              Sua chave Pix cadastrada será exibida no rodapé do relatório para facilitar o pagamento.
            </p>
            <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-xl">
              <Checkbox
                id="include-pix"
                checked={includePixInReport}
                onCheckedChange={(checked) => { setIncludePixInReport(checked === true); }}
              />
              <Label htmlFor="include-pix" className="font-medium cursor-pointer">
                Incluir chave Pix: <span className="text-[var(--accent)]">{vetProfile?.pix_key}</span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowPixDialog(false); generatePDF(false, includePrescriptionInReport, includeReproductiveInReport); }} 
              className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700"
            >
              Gerar sem Pix
            </Button>
            <Button 
              onClick={() => generatePDF(includePixInReport, includePrescriptionInReport, includeReproductiveInReport)} 
              className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium"
            >
              Gerar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Dialog */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--text-primary)]">Finalizar Atendimento</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Tem certeza que deseja finalizar este atendimento? 
              Após finalizado, você poderá gerar prescrições, relatórios e emitir nota fiscal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700 w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => finalizeMutation.mutate()}
              className="bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl dark:bg-slate-800 dark:border-green-600 dark:text-white dark:hover:bg-green-900/30 w-full sm:w-auto"
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? 'Finalizando...' : 'Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--text-primary)]">Excluir Atendimento</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Tem certeza que deseja excluir este atendimento? Essa ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700 w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAppointmentMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl dark:bg-red-700 dark:hover:bg-red-800 w-full sm:w-auto"
              disabled={deleteAppointmentMutation.isPending}
            >
              {deleteAppointmentMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPostCreateDialog} onOpenChange={setShowPostCreateDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Atendimento salvo com sucesso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-muted)]">
            Você está na etapa de confirmação. Adicione fotos do atendimento agora ou vá para a lista de atendimentos.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPostCreateDialog(false)}
              className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700"
            >
              Adicionar fotos
            </Button>
            <Button
              onClick={() => { window.location.href = createPageUrl('Appointments'); }}
              className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:border-green-600 dark:text-white dark:hover:bg-green-900/30"
            >
              Ir para atendimentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
