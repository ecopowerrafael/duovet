import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useAuth } from '../lib/AuthContextJWT';
import { offlineFetch } from '../lib/offline';
import { getWhatsAppLink, isValidWhatsAppNumber } from '../components/utils/whatsapp';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  Stethoscope,
  DollarSign,
  Calendar,
  Milk,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import AnimalIcon from '../components/animals/AnimalIcon';
import { toast } from 'sonner';
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

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLatestAppointmentDate = (appointments = []) => {
  const validTimes = appointments
    .map((appointment) => new Date(appointment?.date).getTime())
    .filter((time) => Number.isFinite(time));
  if (validTimes.length === 0) return null;
  return new Date(Math.max(...validTimes));
};

const STATUS_CONFIG = {
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', darkColor: 'bg-amber-500/20 text-amber-400' },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-700', darkColor: 'bg-green-500/20 text-green-400' },
  faturado: { label: 'Faturado', color: 'bg-purple-100 text-purple-700', darkColor: 'bg-purple-500/20 text-purple-400' }
};

const PAYMENT_STATUS = {
  pendente: { label: 'Pendente', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  parcial: { label: 'Parcial', icon: AlertCircle, color: 'bg-blue-100 text-blue-700' },
  pago: { label: 'Pago', icon: CheckCircle2, color: 'bg-green-100 text-green-700' }
};

export default function ClientDetail() {
  const [activeTab, setActiveTab] = useState('overview');
  const { token } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      return await offlineFetch(`/api/clients/${clientId}`);
    },
    enabled: !!clientId
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      return await offlineFetch('/api/auth/me');
    }
  });

  const isAdmin = userProfile?.email === 'admin@duovet.app';

  const { data: animals = [] } = useQuery({
    queryKey: ['client-animals', clientId],
    queryFn: async () => {
      const email = userProfile?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? `/api/animals?client_id=${clientId}` : `/api/animals?client_id=${clientId}&created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!clientId && !!userProfile?.email
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: async () => {
      const email = userProfile?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? `/api/appointments?client_id=${clientId}&sort=-date` : `/api/appointments?client_id=${clientId}&created_by=${email || ''}&sort=-date`;
      return await offlineFetch(url);
    },
    enabled: !!clientId && !!userProfile?.email
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: async () => {
      const email = userProfile?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? `/api/payments?client_id=${clientId}` : `/api/payments?client_id=${clientId}&created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!clientId && !!userProfile?.email
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['client-properties', clientId],
    queryFn: async () => {
      const email = userProfile?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? `/api/properties?client_id=${clientId}` : `/api/properties?client_id=${clientId}&created_by=${email || ''}`;
      return await offlineFetch(url);
    },
    enabled: !!clientId && !!userProfile?.email
  });

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalRevenue = (appointments || []).reduce((sum, app) => sum + toNumber(app?.total_amount), 0);
  const totalPaid = (payments || []).filter(p => p && p.status === 'pago').reduce((sum, p) => sum + toNumber(p?.amount_paid), 0);
  const totalPending = (payments || []).filter(p => p && p.status !== 'pago').reduce((sum, p) => sum + (toNumber(p?.amount) - toNumber(p?.amount_paid)), 0);
  const latestAppointmentDate = getLatestAppointmentDate(appointments);
  const daysWithoutAttendance = latestAppointmentDate
    ? Math.max(0, Math.floor((new Date().getTime() - latestAppointmentDate.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      {/* Header - iOS Mobile Friendly */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-2xl h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] truncate">{client.name}</h1>
            <p className="text-[var(--text-muted)] mt-0.5 text-sm">Perfil completo do cliente</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto md:ml-auto">
          <Link to={createPageUrl('Properties') + `?new=true&client_id=${clientId}`} className="w-full md:w-auto">
            <Button variant="outline" className="w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold">
              <MapPin className="w-5 h-5" />
              Nova Propriedade
            </Button>
          </Link>
          <Link to={createPageUrl('NewAppointment') + `?client=${clientId}`} className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-2xl font-semibold shadow-lg shadow-[var(--accent)]/25">
              <Stethoscope className="w-5 h-5" />
              Novo Atendimento
            </Button>
          </Link>
        </div>

      {/* Intelligent Alerts */}
      <div className="flex flex-col gap-2">
        {/* 1. No attendance in 90 days */}
        {daysWithoutAttendance !== null && (() => {
          if (daysWithoutAttendance >= 90) {
            return (
              <div className="flex items-center gap-2 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 px-4 py-2 rounded-xl shadow-sm">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span>Cliente sem atendimento há {daysWithoutAttendance} dias.</span>
              </div>
            );
          }
          return null;
        })()}

        {/* 2. Delinquent client (pending payments) */}
        {payments.some(p => p.status !== 'pago') && (
          <div className="flex items-center gap-2 bg-red-100 border-l-4 border-red-400 text-red-800 px-4 py-2 rounded-xl shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span>Cliente inadimplente: há pagamentos pendentes.</span>
          </div>
        )}

        {/* 3. Animal with overdue vaccine */}
        {animals.some(animal => {
          if (!animal.vaccines || !Array.isArray(animal.vaccines)) return false;
          return animal.vaccines.some(vac => {
            if (!vac.due_date) return false;
            const due = new Date(vac.due_date);
            return due < new Date();
          });
        }) && (
          <div className="flex items-center gap-2 bg-orange-100 border-l-4 border-orange-400 text-orange-800 px-4 py-2 rounded-xl shadow-sm">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <span>Algum animal deste cliente está com vacina vencida.</span>
          </div>
        )}
      </div>
      </div>

      {/* Quick Info - iOS Mobile Friendly */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="w-11 h-11 bg-[var(--accent-bg)] rounded-2xl flex items-center justify-center mb-3">
              <AnimalIcon species="outro" className="w-6 h-6" white={false} />
            </div>
            <p className="text-3xl md:text-2xl font-bold text-[var(--text-primary)] mb-1 tracking-tight">{animals.length}</p>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Animais</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="w-11 h-11 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-3">
              <Stethoscope className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-3xl md:text-2xl font-bold text-[var(--text-primary)] mb-1 tracking-tight">{appointments.length}</p>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Atendim.</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="w-11 h-11 bg-green-500/10 rounded-2xl flex items-center justify-center mb-3">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-1 tracking-tight break-all">
              R$ {(totalRevenue / 1000).toFixed(1)}k
            </p>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Faturado</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="w-11 h-11 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-purple-500" />
            </div>
            <p className="text-base md:text-sm font-bold text-[var(--text-primary)] mb-1 break-words">
              {latestAppointmentDate ? safeFormatDate(latestAppointmentDate, "d 'de' MMM") : 'N/A'}
            </p>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Último</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - iOS Mobile Friendly */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[var(--bg-card)] border border-[var(--border-color)] p-1 rounded-2xl w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview" className="rounded-xl flex-shrink-0 text-xs md:text-sm px-3 md:px-4">Visão Geral</TabsTrigger>
          <TabsTrigger value="animals" className="rounded-xl flex-shrink-0 text-xs md:text-sm px-3 md:px-4">Animais</TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-xl flex-shrink-0 text-xs md:text-sm px-3 md:px-4">Atend.</TabsTrigger>
          <TabsTrigger value="financial" className="rounded-xl flex-shrink-0 text-xs md:text-sm px-3 md:px-4">Financ.</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-xl flex-shrink-0 text-xs md:text-sm px-3 md:px-4">Obs.</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.document && (
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[var(--text-muted)]" />
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">CPF/CNPJ</p>
                      <p className="font-medium text-[var(--text-primary)]">{client.document}</p>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Phone className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-muted)]">Telefone / WhatsApp</p>
                        <p className="font-medium text-[var(--text-primary)] break-all">{client.phone}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-2xl gap-2 h-11 w-full md:w-auto font-semibold"
                      style={{ 
                        backgroundColor: '#25D366',
                        color: 'white'
                      }}
                      onClick={() => {
                        if (!isValidWhatsAppNumber(client.phone)) {
                          toast.error('Número de WhatsApp inválido');
                          return;
                        }
                        const link = getWhatsAppLink(client.phone);
                        if (link) {
                          window.open(link, '_blank');
                        }
                      }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </Button>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[var(--text-muted)]" />
                    <div>
                      <p className="text-sm text-[var(--text-muted)]">E-mail</p>
                      <p className="font-medium text-[var(--text-primary)]">{client.email}</p>
                    </div>
                  </div>
                )}
                {properties.length > 0 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-muted)]">Propriedades</p>
                      <p className="font-medium text-[var(--text-primary)] break-words">
                        {properties.map(p => p.name).join(', ')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Total Faturado</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Total Pago</span>
                  <span className="font-bold text-green-500">
                    R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Em Aberto</span>
                  <span className="font-bold text-amber-500">
                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Ticket Médio</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    R$ {appointments.length > 0 ? (totalRevenue / appointments.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Animals Tab */}
        <TabsContent value="animals">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {animals.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Milk className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-primary)] font-semibold">Nenhum animal cadastrado</p>
              </div>
            ) : (
              animals.map((animal) => (
                <Link key={animal.id || animal._id} to={createPageUrl('AnimalDetail') + `?id=${animal.id || animal._id}`}>
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        {animal.photo_url ? (
                          <img src={animal.photo_url} alt={animal.name} className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-[var(--accent-bg)] rounded-xl flex items-center justify-center">
                            <AnimalIcon species={animal.species} className="w-6 h-6" white={false} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-[var(--text-primary)]">{animal.name}</h4>
                          <p className="text-sm text-[var(--text-muted)] capitalize">{animal.species}</p>
                        </div>
                      </div>
                      {animal.identification && (
                        <p className="text-xs text-[var(--text-muted)]">ID: {animal.identification}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="text-center py-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
                <Stethoscope className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-primary)] font-semibold">Nenhum atendimento registrado</p>
              </div>
            ) : (
              appointments.map((appointment) => (
                <Link key={appointment.id || appointment._id} to={createPageUrl('AppointmentDetail') + `?id=${appointment.id || appointment._id}`}>
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-6 h-6 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[var(--text-primary)] mb-0.5">
                              {safeFormatDate(appointment.date)}
                            </h4>
                            <p className="text-sm text-[var(--text-muted)] capitalize truncate">
                              {appointment.type || 'Consulta Geral'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 justify-between md:justify-end">
                          <Badge className={`${STATUS_CONFIG[appointment.status]?.color || 'bg-gray-100 text-gray-700'} border-none font-semibold px-3 py-1 rounded-xl`}>
                            {STATUS_CONFIG[appointment.status]?.label || appointment.status}
                          </Badge>
                          <p className="font-bold text-[var(--text-primary)]">
                            R$ {(appointment.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <div className="space-y-4">
            {payments.length === 0 ? (
              <div className="text-center py-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
                <DollarSign className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-primary)] font-semibold">Nenhum pagamento registrado</p>
              </div>
            ) : (
              payments.map((payment) => {
                const statusConfig = PAYMENT_STATUS[payment.status];
                const Icon = statusConfig.icon;
                return (
                  <Card key={payment.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${statusConfig.color} rounded-xl flex items-center justify-center`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              R$ {(payment.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              {payment.payment_method ? payment.payment_method.replace('_', ' ').toUpperCase() : 'Pendente'}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardContent className="p-6">
              {client.notes ? (
                <p className="text-[var(--text-primary)] whitespace-pre-wrap">{client.notes}</p>
              ) : (
                <p className="text-[var(--text-muted)] text-center py-8">Nenhuma observação registrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
