import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useAuth } from '../lib/AuthContextJWT';
import { offlineFetch, getPendingMutations } from '../lib/offline';
import { useQuery } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  GitBranch,
  Stethoscope,
  Scale,
  Palette,
  Tag,
  Edit,
  Clock,
  TrendingUp
} from 'lucide-react';
import AnimalIcon from '../components/animals/AnimalIcon';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AnimalTimeline from '../components/animals/AnimalTimeline';
import ZootechnicalIndicators from '../components/animals/ZootechnicalIndicators';
import { compareIds } from '../lib/utils';
import {
  getAppointmentAnimalIds,
  normalizeAppointmentForAnalysis,
  normalizeObjectValue
} from '../lib/appointments';

const SPECIES = {
  bovino: 'Bovino',
  equino: 'Equino',
  ovino: 'Ovino',
  caprino: 'Caprino',
  suino: 'Suíno',
  bubalino: 'Bubalino',
  outro: 'Outro'
};

const STATUS = {
  ativo: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  vendido: { label: 'Vendido', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  obito: { label: 'Óbito', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  abatido: { label: 'Abatido', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
};

const hasAndrologicalValues = (data) => {
  if (!data) return false;
  return Boolean(
    data.volume ||
    data.motility ||
    data.vigor ||
    data.concentration_ml ||
    data.total_concentration ||
    data.observations
  );
};

const hasReproductiveValues = (data) => {
  if (!data) return false;
  return Boolean(
    data.cervix ||
    data.ut ||
    data.oe ||
    data.od ||
    data.protocol ||
    data.semen ||
    data.semen_packaging ||
    data.pregnancy_result ||
    data.embryo_donor ||
    data.embryo_recipient ||
    data.observations
  );
};

const mergeHistoricalByAppointment = (primary = [], historical = []) => {
  const normalizedPrimary = (primary || []).filter(Boolean).map((item) => ({
    ...item,
    source: item?.source || 'registro'
  }));
  const merged = [...normalizedPrimary];
  const existingByAppointment = new Set(
    normalizedPrimary
      .map((item) => item?.appointment_id)
      .filter(Boolean)
      .map(String)
  );

  (historical || []).forEach((item) => {
    if (!item) return;
    const appointmentKey = item?.appointment_id ? String(item.appointment_id) : null;
    if (appointmentKey && existingByAppointment.has(appointmentKey)) return;
    merged.push(item);
  });

  return merged.sort((a, b) => {
    const dateA = a?.date ? new Date(a.date).getTime() : 0;
    const dateB = b?.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });
};

export default function AnimalDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const animalId = urlParams.get('id');

  const { user: authUser } = useAuth();
  const { data: animal, isLoading } = useQuery({
    queryKey: ['animal', animalId],
    queryFn: async () => {
      return await offlineFetch(`/api/animals/${animalId}`);
    },
    enabled: !!animalId
  });

  const { data: fallbackUser } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    },
    enabled: !authUser?.email
  });

  const currentUser = authUser || fallbackUser || null;
  const userEmail = currentUser?.email || '';
  const isAdmin = userEmail === 'admin@duovet.app';

  const { data: animals = [] } = useQuery({
    queryKey: ['animals', userEmail],
    queryFn: async () => {
      const email = userEmail;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/animals' : `/api/animals?created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!userEmail
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', userEmail],
    queryFn: async () => {
      const email = userEmail;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!userEmail
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', userEmail],
    queryFn: async () => {
      const email = userEmail;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!userEmail
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', userEmail, animal?.id || animal?._id || animalId],
    queryFn: async () => {
      const email = userEmail;
      const isAdmin = email === 'admin@duovet.app';
      const currentAnimalId = animal?.id || animal?._id || animalId;
      const url = isAdmin
        ? `/api/appointments?animal_id=${currentAnimalId}&sort=-date`
        : `/api/appointments?created_by=${email || ''}&animal_id=${currentAnimalId}&sort=-date`;
      const primaryResult = await offlineFetch(url);
      if (Array.isArray(primaryResult) && primaryResult.length > 0) {
        return primaryResult;
      }
      const fallbackUrl = isAdmin
        ? '/api/appointments?sort=-date'
        : `/api/appointments?created_by=${encodeURIComponent(email || '')}&sort=-date`;
      const fallbackResult = await offlineFetch(fallbackUrl);
      return Array.isArray(fallbackResult) ? fallbackResult : [];
    },
    enabled: !!userEmail && !!(animal?.id || animal?._id || animalId)
  });

  const { data: reproductiveData = [] } = useQuery({
    queryKey: ['reproductiveData', animal?.id || animal?._id],
    queryFn: async () => {
      const id = animal?.id || animal?._id;
      return await offlineFetch(`/api/reproductivedata?animal_id=${id}&sort=-date`);
    },
    enabled: !!(animal?.id || animal?._id)
  });

  const { data: andrologicalData = [] } = useQuery({
    queryKey: ['andrologicalData', animal?.id || animal?._id],
    queryFn: async () => {
      const id = animal?.id || animal?._id;
      return await offlineFetch(`/api/andrologicaldata?animal_id=${id}&sort=-date`);
    },
    enabled: !!(animal?.id || animal?._id) && animal?.sex === 'macho'
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Animal não encontrado</p>
        <Link to={createPageUrl('Animals')}>
          <Button variant="link" className="mt-4 text-[var(--accent)]">Voltar aos animais</Button>
        </Link>
      </div>
    );
  }

  const client = (clients || []).find(c => c && compareIds(c.id || c._id, animal.client_id || animal.owner_id));
  const property = (properties || []).find(p => p && compareIds(p.id || p._id, animal.property_id));
  const father = (animals || []).find(a => a && compareIds(a.id || a._id, animal.father_id));
  const mother = (animals || []).find(a => a && compareIds(a.id || a._id, animal.mother_id));
  const offspring = (animals || []).filter(a => a && (compareIds(a.father_id, animal.id || animal._id) || compareIds(a.mother_id, animal.id || animal._id)));
  const pendingAppointments = (getPendingMutations() || [])
    .filter((mutation) => mutation?.method === 'POST' && String(mutation?.url || '').includes('/api/appointments'))
    .map((mutation) => normalizeAppointmentForAnalysis({
      ...(mutation?.body || {}),
      id: mutation?.id,
      isPending: true
    }))
    .filter(Boolean);
  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  const profileAppointments = [...pendingAppointments, ...normalizedAppointments];
  const animalAppointments = profileAppointments.filter((appointmentItem) => {
    if (!appointmentItem) return false;
    const currentAnimalId = animal.id || animal._id;
    if (!currentAnimalId) return false;
    const appointmentAnimalIds = getAppointmentAnimalIds(appointmentItem);
    return appointmentAnimalIds.some((itemId) => compareIds(itemId, currentAnimalId));
  });
  const appointmentBasedAndrologicalData = animalAppointments
    .filter((appointmentItem) => appointmentItem?.type === 'reprodutivo' && hasAndrologicalValues(normalizeObjectValue(appointmentItem?.andrological_data)))
    .map((appointmentItem) => {
      const andrological = normalizeObjectValue(appointmentItem.andrological_data);
      return {
        id: `historical-andro-${appointmentItem.id || appointmentItem._id}`,
        appointment_id: appointmentItem.id || appointmentItem._id,
        date: appointmentItem.date,
        volume: andrological.volume || '',
        motility: andrological.motility || '',
        vigor: andrological.vigor || '',
        concentration_ml: andrological.concentration_ml || '',
        total_concentration: andrological.total_concentration || '',
        observations: andrological.observations || '',
        source: 'historico'
      };
    });
  const appointmentBasedReproductiveData = animalAppointments
    .filter((appointmentItem) => appointmentItem?.type === 'reprodutivo' && hasReproductiveValues(normalizeObjectValue(appointmentItem?.reproductive_data)))
    .map((appointmentItem) => {
      const reproductive = normalizeObjectValue(appointmentItem.reproductive_data);
      return {
        id: `historical-repro-${appointmentItem.id || appointmentItem._id}`,
        appointment_id: appointmentItem.id || appointmentItem._id,
        date: appointmentItem.date,
        cervix: reproductive.cervix || '',
        ut: reproductive.ut || '',
        oe: reproductive.oe || '',
        od: reproductive.od || '',
        protocol: reproductive.protocol || '',
        semen: reproductive.semen || '',
        semen_packaging: reproductive.semen_packaging || '',
        pregnancy_result: reproductive.pregnancy_result || '',
        embryo_donor: reproductive.embryo_donor || '',
        embryo_recipient: reproductive.embryo_recipient || '',
        observations: reproductive.observations || '',
        source: 'historico'
      };
    });
  const mergedAndrologicalData = mergeHistoricalByAppointment(andrologicalData, appointmentBasedAndrologicalData);
  const mergedReproductiveData = mergeHistoricalByAppointment(reproductiveData, appointmentBasedReproductiveData);
  const statusInfo = STATUS[animal.status] || STATUS.ativo;

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

  const getAge = () => {
    if (!animal.birth_date) return null;
    try {
      const birthDate = new Date(animal.birth_date);
      if (isNaN(birthDate.getTime())) return null;
      const years = differenceInYears(new Date(), birthDate);
      const months = differenceInMonths(new Date(), birthDate) % 12;
      
      if (years > 0) {
        return `${years} ano${years > 1 ? 's' : ''} ${months > 0 ? `e ${months} mês${months > 1 ? 'es' : ''}` : ''}`;
      }
      return `${months} mês${months > 1 ? 'es' : ''}`;
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - iOS Mobile Friendly */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] truncate">{animal.name}</h1>
            <p className="text-[var(--text-secondary)] text-sm">Detalhes do animal</p>
          </div>
        </div>
        <Link to={createPageUrl('Animals') + `?edit=${animal.id}`} className="w-full md:w-auto md:ml-auto">
          <Button className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-2xl gap-2 h-12 px-6 shadow-lg shadow-[var(--accent)]/25">
            <Edit className="w-4 h-4" />
            Editar
          </Button>
        </Link>
      </div>

      {/* Animal Profile Card - iOS Mobile Friendly */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-[var(--accent)] to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[var(--accent)]/25 mx-auto md:mx-0">
            <AnimalIcon species={animal.species} className="w-10 h-10 md:w-12 md:h-12 text-white" />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
              <Badge className={`${statusInfo.color} border font-semibold text-xs px-3 py-1 rounded-lg`}>{statusInfo.label}</Badge>
              {animal.sex && (
                <Badge className={`${animal.sex === 'macho' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-pink-500/20 text-pink-400 border-pink-500/30'} border font-semibold text-xs px-3 py-1 rounded-lg`}>
                  {animal.sex === 'macho' ? '♂ Macho' : '♀ Fêmea'}
                </Badge>
              )}
            </div>
            <h2 className="text-2xl md:text-xl font-bold text-[var(--text-primary)] mb-1.5 text-center md:text-left tracking-tight break-words">{animal.name}</h2>
            <p className="text-[var(--text-secondary)] text-center md:text-left font-medium break-words">
              {SPECIES[animal.species] || animal.species}
              {animal.breed && ` • ${animal.breed}`}
            </p>
            
            {/* Stats */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 mt-4">
              {animal.identification && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] break-all">{animal.identification}</span>
                </div>
              )}
              {animal.weight && (
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">{animal.weight} kg</span>
                </div>
              )}
              {animal.color && (
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] break-words">{animal.color}</span>
                </div>
              )}
              {animal.birth_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] break-words">{getAge()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile CTA */}
        <Link to={createPageUrl('NewAppointment') + `?animal=${animal.id}`} className="md:hidden block mt-5">
          <Button className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-2xl gap-2 h-12 shadow-lg shadow-[var(--accent)]/25">
            <Stethoscope className="w-5 h-5" />
            Novo Atendimento
          </Button>
        </Link>
      </div>

      {/* Tabs Section */}
       <Tabs defaultValue="timeline" className="space-y-6">
         <TabsList className="bg-[var(--bg-tertiary)] p-1 rounded-2xl w-full overflow-x-auto flex-nowrap">
           <TabsTrigger value="timeline" className="rounded-xl data-[state=active]:bg-[var(--bg-card)] data-[state=active]:text-[var(--text-primary)] gap-2 flex-shrink-0 text-xs md:text-sm px-3 md:px-4">
             <Clock className="w-4 h-4" />
             <span className="hidden md:inline">Linha do Tempo</span>
             <span className="md:hidden">Tempo</span>
           </TabsTrigger>
           <TabsTrigger value="reproductive" className="rounded-xl data-[state=active]:bg-[var(--bg-card)] data-[state=active]:text-[var(--text-primary)] gap-2 flex-shrink-0 text-xs md:text-sm px-3 md:px-4">
             <span>🧬</span>
             <span className="hidden md:inline">Dados Reprodutivos</span>
             <span className="md:hidden">Reprod.</span>
           </TabsTrigger>
           <TabsTrigger value="indicators" className="rounded-xl data-[state=active]:bg-[var(--bg-card)] data-[state=active]:text-[var(--text-primary)] gap-2 flex-shrink-0 text-xs md:text-sm px-3 md:px-4">
             <TrendingUp className="w-4 h-4" />
             <span className="hidden md:inline">Indicadores</span>
             <span className="md:hidden">Indic.</span>
           </TabsTrigger>
           <TabsTrigger value="genealogy" className="rounded-xl data-[state=active]:bg-[var(--bg-card)] data-[state=active]:text-[var(--text-primary)] gap-2 flex-shrink-0 text-xs md:text-sm px-3 md:px-4">
             <GitBranch className="w-4 h-4" />
             <span className="hidden md:inline">Genealogia</span>
             <span className="md:hidden">Gen.</span>
           </TabsTrigger>
         </TabsList>

        {/* Timeline Tab - iOS Mobile Friendly */}
        <TabsContent value="timeline" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 md:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-5 h-5 text-[var(--accent)]" />
                  <h3 className="font-bold text-[var(--text-primary)] tracking-tight">Linha do Tempo</h3>
                </div>
                <AnimalTimeline appointments={animalAppointments} />
              </div>
            </div>

            {/* Sidebar - iOS Mobile Friendly */}
            <div className="space-y-4 md:space-y-6">
              {/* Owner & Property */}
              {client && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Proprietário</p>
                    <p className="font-bold text-[var(--text-primary)] break-words">{client.name}</p>
                  </div>
                </div>
              )}
              {property && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Propriedade</p>
                    <p className="font-bold text-[var(--text-primary)] break-words">{property.name}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {animal.notes && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 md:p-6">
                  <h3 className="font-bold text-[var(--text-primary)] mb-3 tracking-tight">Observações</h3>
                  <p className="text-[var(--text-secondary)] whitespace-pre-wrap text-sm break-words">{animal.notes}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Reproductive Data Tab - iOS Mobile Friendly */}
         <TabsContent value="reproductive" className="mt-6">
           <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 md:p-6">
             <div className="flex items-center gap-2 mb-6">
               <span className="text-2xl">🧬</span>
               <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                 Histórico de {animal.sex === 'macho' ? 'Exames Andrológicos' : 'Exames Ginecológicos'}
               </h3>
             </div>

             {/* Andrological Data - Males only */}
             {animal.sex === 'macho' && (
               <>
                 {mergedAndrologicalData.length === 0 ? (
                   <div className="text-center py-12">
                     <p className="text-[var(--text-muted)]">Nenhum exame andrológico registrado para este animal</p>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {(mergedAndrologicalData || []).filter(Boolean).map(data => (
                       <div key={data.id} className="border border-[var(--border-color)] rounded-2xl p-5 bg-[var(--bg-tertiary)]">
                         <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-4">
                           <div className="flex-1">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Data do Exame</p>
                             <p className="font-bold text-[var(--text-primary)]">
                               {safeFormatDate(data.date)}
                             </p>
                           </div>
                           <div className="text-left md:text-right">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Atendimento</p>
                             <p className="font-bold text-[var(--accent)] break-all">#{String(data.appointment_id || '').slice(0, 8) || 'N/A'}</p>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                           {data.volume && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Volume</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.volume}</p>
                             </div>
                           )}
                           {data.motility && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Motilidade</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.motility}</p>
                             </div>
                           )}
                           {data.vigor && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Vigor</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.vigor}</p>
                             </div>
                           )}
                           {data.concentration_ml && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Concentração/mL</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.concentration_ml}</p>
                             </div>
                           )}
                           {data.total_concentration && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Concentração Total</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.total_concentration}</p>
                             </div>
                           )}
                         </div>

                         {data.observations && (
                           <div className="mt-4 bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Observações</p>
                             <p className="text-sm text-[var(--text-primary)]">{data.observations}</p>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
               </>
             )}

             {/* Gynecological Data - Females only */}
             {animal.sex === 'femea' && (
               <>
                 {mergedReproductiveData.length === 0 ? (
                   <div className="text-center py-12">
                     <p className="text-[var(--text-muted)]">Nenhum exame ginecológico registrado para este animal</p>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {mergedReproductiveData.map(data => (
                       <div key={data.id} className="border border-[var(--border-color)] rounded-2xl p-5 bg-[var(--bg-tertiary)]">
                         <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-4">
                           <div className="flex-1">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Data do Exame</p>
                             <p className="font-bold text-[var(--text-primary)]">
                               {format(new Date(data.date), 'dd/MM/yyyy', { locale: ptBR })}
                             </p>
                           </div>
                           <div className="text-left md:text-right">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Atendimento</p>
                             <p className="font-bold text-[var(--accent)] break-all">#{String(data.appointment_id || '').slice(0, 8) || 'N/A'}</p>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                           {data.cervix && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Cérvix</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.cervix}</p>
                             </div>
                           )}
                           {data.ut && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Útero (UT)</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.ut}</p>
                             </div>
                           )}
                           {data.oe && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Ovário Esquerdo (OE)</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.oe}</p>
                             </div>
                           )}
                           {data.od && (
                             <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                               <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Ovário Direito (OD)</p>
                               <p className="text-sm text-[var(--text-primary)]">{data.od}</p>
                             </div>
                           )}
                         </div>

                         {data.observations && (
                           <div className="mt-4 bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-color)]">
                             <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Observações</p>
                             <p className="text-sm text-[var(--text-primary)]">{data.observations}</p>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
               </>
             )}

             {/* If sex is not set */}
             {!animal.sex && (
               <div className="text-center py-12">
                 <p className="text-[var(--text-muted)]">
                   Configure o sexo do animal para visualizar os dados reprodutivos
                 </p>
               </div>
             )}
           </div>
         </TabsContent>

         {/* Indicators Tab */}
         <TabsContent value="indicators" className="mt-6">
           <ZootechnicalIndicators 
             animal={animal} 
             appointments={animalAppointments} 
             allAnimals={animals} 
           />
         </TabsContent>

        {/* Genealogy Tab - iOS Mobile Friendly */}
        <TabsContent value="genealogy" className="mt-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <GitBranch className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-bold text-[var(--text-primary)] tracking-tight">Árvore Genealógica</h3>
            </div>

            {/* Parents - iOS Mobile Friendly */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Father */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                <div className="mb-3">
                  <p className="text-sm text-blue-400 uppercase tracking-wider font-bold">Pai</p>
                </div>
                {father || animal.father_name ? (
                  <div className="space-y-2">
                    {father ? (
                      <Link 
                        to={createPageUrl('AnimalDetail') + `?id=${father.id}`}
                        className="block font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors break-words"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-all">{father.name}</span>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">(cadastrado)</span>
                        </span>
                        {father.breed && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 break-words">
                            Raça: {father.breed}
                          </p>
                        )}
                        {father.identification && (
                          <p className="text-xs text-[var(--text-muted)] break-all">
                            ID: {father.identification}
                          </p>
                        )}
                      </Link>
                    ) : (
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] break-words">{animal.father_name}</p>
                        {animal.father_breed && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 break-words">
                            Raça: {animal.father_breed}
                          </p>
                        )}
                        {animal.father_notes && (
                          <p className="text-xs text-[var(--text-muted)] italic mt-1 break-words">
                            {animal.father_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--text-muted)] text-sm">Não informado</span>
                )}
              </div>

              {/* Mother */}
              <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-5">
                <div className="mb-3">
                  <p className="text-sm text-pink-400 uppercase tracking-wider font-bold">Mãe</p>
                </div>
                {mother || animal.mother_name ? (
                  <div className="space-y-2">
                    {mother ? (
                      <Link 
                        to={createPageUrl('AnimalDetail') + `?id=${mother.id}`}
                        className="block font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors break-words"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-all">{mother.name}</span>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">(cadastrado)</span>
                        </span>
                        {mother.breed && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 break-words">
                            Raça: {mother.breed}
                          </p>
                        )}
                        {mother.identification && (
                          <p className="text-xs text-[var(--text-muted)] break-all">
                            ID: {mother.identification}
                          </p>
                        )}
                      </Link>
                    ) : (
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] break-words">{animal.mother_name}</p>
                        {animal.mother_breed && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 break-words">
                            Raça: {animal.mother_breed}
                          </p>
                        )}
                        {animal.mother_notes && (
                          <p className="text-xs text-[var(--text-muted)] italic mt-1 break-words">
                            {animal.mother_notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--text-muted)] text-sm">Não informado</span>
                )}
              </div>
            </div>

            {/* Offspring - iOS Mobile Friendly */}
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-3">
                Filhos ({offspring.length})
              </p>
              {offspring.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">Nenhum filho registrado</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {offspring.map(child => (
                    <Link
                      key={child.id}
                      to={createPageUrl('AnimalDetail') + `?id=${child.id}`}
                      className="p-4 bg-[var(--bg-tertiary)] rounded-2xl hover:bg-[var(--accent)]/10 transition-all border border-[var(--border-color)]"
                    >
                      <p className="font-semibold text-[var(--text-primary)] break-words">{child.name}</p>
                      <p className="text-xs text-[var(--text-muted)] break-words">
                        {child.sex === 'macho' ? '♂' : '♀'} {child.breed || SPECIES[child.species]}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
