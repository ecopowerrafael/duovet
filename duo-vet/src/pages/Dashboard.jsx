import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Users,
  Stethoscope,
  DollarSign,
  Plus,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Receipt,
  Play,
  Eye,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  RotateCw
} from 'lucide-react';
import { format, isBefore, startOfMonth, endOfMonth, startOfDay, endOfDay, eachDayOfInterval, subDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import QuickAppointment from '../components/QuickAppointment';
import ReturnAlertsCard from '../components/dashboard/ReturnAlertsCard';
import { offlineFetch, getPendingMutations } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { toast } from 'sonner';
import { compareIds } from '../lib/utils';
import {
  getAppointmentClientId,
  getAppointmentPropertyId,
  normalizeAppointmentForAnalysis
} from '../lib/appointments';

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

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showQuickAppointment, setShowQuickAppointment] = useState(false);
  const { user: authUser } = useAuth();

  const { data: fallbackUser } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    },
    enabled: !authUser?.email
  });
  const userEmail = authUser?.email || fallbackUser?.email || '';
  const isAdminUser = userEmail === 'admin@duovet.app';

  const { data: clients = [], refetch: refetchClients, isRefetching: isRefetchingClients } = useQuery({
    queryKey: ['clients', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/clients${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const { data: animals = [], refetch: refetchAnimals, isRefetching: isRefetchingAnimals } = useQuery({
    queryKey: ['animals', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/animals${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const { data: appointments = [], refetch: refetchAppointments, isRefetching: isRefetchingAppointments } = useQuery({
    queryKey: ['appointments', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/appointments${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  // Get pending appointments from offline queue
  const pendingMutations = getPendingMutations();
  const pendingAppointments = pendingMutations
    .filter(m => m.url.includes('/api/appointments') && m.method === 'POST')
    .map(m => normalizeAppointmentForAnalysis({
      ...m.body,
      id: m.id,
      isPending: true
    }))
    .filter(Boolean);

  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  const allAppointments = [...pendingAppointments, ...normalizedAppointments];

  const { data: properties = [], refetch: refetchProperties, isRefetching: isRefetchingProperties } = useQuery({
    queryKey: ['properties', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/properties${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const { data: payments = [], refetch: refetchPayments, isRefetching: isRefetchingPayments } = useQuery({
    queryKey: ['payments', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/payments${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const { data: events = [], refetch: refetchEvents, isRefetching: isRefetchingEvents } = useQuery({
    queryKey: ['events', userEmail],
    queryFn: async () => {
      const query = isAdminUser ? '' : `?created_by=${userEmail}`;
      const res = await offlineFetch(`/api/events${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!userEmail
  });

  const isRefetching = isRefetchingClients || isRefetchingAnimals || isRefetchingAppointments || isRefetchingProperties || isRefetchingPayments || isRefetchingEvents;

  const handleManualRefresh = async () => {
    toast.promise(
      (async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['clients'] }),
          queryClient.invalidateQueries({ queryKey: ['animals'] }),
          queryClient.invalidateQueries({ queryKey: ['appointments'] }),
          queryClient.invalidateQueries({ queryKey: ['appointments-with-return'] }),
          queryClient.invalidateQueries({ queryKey: ['properties'] }),
          queryClient.invalidateQueries({ queryKey: ['payments'] }),
          queryClient.invalidateQueries({ queryKey: ['events'] }),
          queryClient.invalidateQueries({ queryKey: ['vetProfile'] }),
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
        ]);

        return Promise.all([
          refetchClients(),
          refetchAnimals(),
          refetchAppointments(),
          refetchProperties(),
          refetchPayments(),
          refetchEvents()
        ]);
      })(),
      {
        loading: 'Sincronizando dados...',
        success: 'Dashboard atualizado!',
        error: 'Erro ao sincronizar dados'
      }
    );
  };

  // Data calculations
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const previousMonthDate = addMonths(today, -1);
  const previousMonthStart = startOfMonth(previousMonthDate);
  const previousMonthEnd = endOfMonth(previousMonthDate);

  const todayAppointments = (allAppointments || []).filter(a => {
    if (!a || !a.date) return false;
    try {
      const appointmentDate = new Date(a.date);
      if (isNaN(appointmentDate.getTime())) return false;
      return appointmentDate >= startOfDay(today) && appointmentDate <= endOfDay(today);
    } catch (e) {
      return false;
    }
  }).sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });

  const todayEvents = (events || []).filter(e => {
    if (!e || !e.start_datetime) return false;
    try {
      const eventDate = new Date(e.start_datetime);
      if (isNaN(eventDate.getTime())) return false;
      return eventDate >= startOfDay(today) && eventDate <= endOfDay(today);
    } catch (err) {
      return false;
    }
  }).sort((a, b) => {
    const dateA = a.start_datetime ? new Date(a.start_datetime).getTime() : 0;
    const dateB = b.start_datetime ? new Date(b.start_datetime).getTime() : 0;
    return dateA - dateB;
  });

  const inProgressAppointments = (allAppointments || []).filter(a => a && a.status === 'em_andamento');
  const withoutInvoice = (allAppointments || []).filter(a => a && a.status === 'finalizado');
  const getClientEntityId = (entity) => entity?.id || entity?._id;
  const getRelatedClientId = (record) =>
    record?.client_id ||
    record?.clientId ||
    record?.id_client ||
    record?.owner_id ||
    record?.ownerId ||
    record?.owner?.id ||
    record?.owner?._id;
  
  const clientIdsFromClients = new Set(
    (clients || [])
      .map((client) => getClientEntityId(client))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const clientIdsFromAppointments = new Set(
    (allAppointments || [])
      .map((appointment) => getAppointmentClientId(appointment))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const clientIdsFromAnimals = new Set(
    (animals || [])
      .map((animal) => getRelatedClientId(animal))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const clientIdsFromProperties = new Set(
    (properties || [])
      .map((property) => getRelatedClientId(property))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const totalClientIds = new Set([
    ...clientIdsFromClients,
    ...clientIdsFromAppointments,
    ...clientIdsFromAnimals,
    ...clientIdsFromProperties
  ]);
  const totalClientsCount = totalClientIds.size;
  const activeClientsCutoff = subDays(today, 90);
  const activeClientIds = new Set(
    (allAppointments || [])
      .filter((appointment) => {
        if (!appointment?.date) return false;
        try {
          const appointmentDate = new Date(appointment.date);
          if (isNaN(appointmentDate.getTime())) return false;
          return appointmentDate >= activeClientsCutoff && appointmentDate <= today;
        } catch (err) {
          return false;
        }
      })
      .map((appointment) => getAppointmentClientId(appointment))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const activeClientsCount = activeClientIds.size;

  const monthAppointments = (allAppointments || []).filter(a => {
    if (!a || !a.date) return false;
    try {
      const date = new Date(a.date);
      if (isNaN(date.getTime())) return false;
      return date >= monthStart && date <= monthEnd;
    } catch (err) {
      return false;
    }
  });

  const monthRevenue = monthAppointments
    .filter(a => a && (a.status === 'finalizado' || a.status === 'faturado'))
    .reduce((sum, a) => sum + toNumber(a.total_amount), 0);

  const previousMonthRevenue = (allAppointments || [])
    .filter(a => {
      if (!a || !a.date) return false;
      try {
        const date = new Date(a.date);
        if (isNaN(date.getTime())) return false;
        const isBilled = a.status === 'finalizado' || a.status === 'faturado';
        return isBilled && date >= previousMonthStart && date <= previousMonthEnd;
      } catch (err) {
        return false;
      }
    })
    .reduce((sum, a) => sum + toNumber(a.total_amount), 0);

  const revenueTrend = previousMonthRevenue > 0
    ? Number((((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1))
    : 0;

  const monthPayments = (payments || []).filter(p => {
    if (!p || !p.payment_date) return false;
    try {
      const date = new Date(p.payment_date);
      if (isNaN(date.getTime())) return false;
      return date >= monthStart && date <= monthEnd;
    } catch (err) {
      return false;
    }
  });

  const receivedAmount = monthPayments
    .filter(p => p && p.status === 'pago')
    .reduce((sum, p) => sum + toNumber(p.amount_paid), 0);

  const pendingAmount = Math.max(monthRevenue - receivedAmount, 0);

  // Revenue chart data (last 7 days)
  const last7Days = eachDayOfInterval({
    start: subDays(today, 6),
    end: today
  });

  const chartData = last7Days.map(date => {
    const dayAppointments = (allAppointments || []).filter(a => {
      if (!a || !a.date) return false;
      try {
        const apptDate = new Date(a.date);
        if (isNaN(apptDate.getTime())) return false;
        return apptDate.toDateString() === date.toDateString() && 
               (a.status === 'finalizado' || a.status === 'faturado');
      } catch (err) {
        return false;
      }
    });
    const revenue = dayAppointments.reduce((sum, a) => sum + toNumber(a.total_amount), 0);
    return {
      name: format(date, 'EEE', { locale: ptBR }),
      value: revenue
    };
  });

  // Alerts
  const alerts = [];

  const paidAppointmentIds = new Set(
    (payments || [])
      .filter((payment) => payment && payment.status === 'pago' && payment.appointment_id)
      .map((payment) => String(payment.appointment_id))
  );
  const clientIdsWithUnpaidPayments = new Set(
    (payments || [])
      .filter((payment) => payment && payment.status !== 'pago')
      .map((payment) => payment.client_id || payment.clientId || payment.id_client)
      .filter(Boolean)
      .map((id) => String(id))
  );
  const clientIdsWithCompletedAppointmentsWithoutPaidPayment = new Set(
    (allAppointments || [])
      .filter((appointment) => {
        if (!appointment) return false;
        if (appointment.status !== 'finalizado' && appointment.status !== 'faturado') return false;
        const appointmentId = appointment.id || appointment._id;
        if (!appointmentId) return false;
        return !paidAppointmentIds.has(String(appointmentId));
      })
      .map((appointment) => getAppointmentClientId(appointment))
      .filter(Boolean)
      .map((id) => String(id))
  );
  const clientsWithoutPaymentCount = new Set([
    ...clientIdsWithUnpaidPayments,
    ...clientIdsWithCompletedAppointmentsWithoutPaidPayment
  ]).size;
  if (clientsWithoutPaymentCount > 0) {
    alerts.push({
      type: 'warning',
      title: `${clientsWithoutPaymentCount} cliente(s) sem pagamento`,
      description: 'Acompanhe as pendências financeiras',
      action: 'Financial'
    });
  }

  const nextSevenDaysEnd = endOfDay(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  const upcomingReturnsCount = (allAppointments || []).filter((appointment) => {
    if (!appointment?.needs_return || !appointment?.return_date) return false;
    if (appointment.return_status === 'realizado' || appointment.return_completed === true) return false;
    try {
      const returnDate = new Date(appointment.return_date);
      if (isNaN(returnDate.getTime())) return false;
      return returnDate >= startOfDay(today) && returnDate <= nextSevenDaysEnd;
    } catch (err) {
      return false;
    }
  }).length;
  if (upcomingReturnsCount > 0) {
    alerts.push({
      type: 'warning',
      title: `${upcomingReturnsCount} próximo(s) retorno(s)`,
      description: 'Organize os retornos dos próximos 7 dias',
      action: 'Appointments'
    });
  }

  // Pagamentos em atraso
  const overduePayments = (payments || []).filter(p => {
    if (!p || p.status === 'pago' || !p.due_date) return false;
    try {
      const dueDate = new Date(p.due_date);
      if (isNaN(dueDate.getTime())) return false;
      return isBefore(dueDate, today);
    } catch (err) {
      return false;
    }
  });
  if (overduePayments.length > 0) {
    alerts.push({
      type: 'error',
      title: `${overduePayments.length} pagamento(s) em atraso`,
      description: 'Verifique contas a receber',
      action: 'Financial'
    });
  }

  // Pending returns count (mock for KPI card)
  const pendingReturnsCount = 0; // Replace with real count if available

  const primaryKpis = [
    {
      title: 'Atendimentos Hoje',
      value: todayAppointments.length,
      subtitle: todayEvents.length > 0 ? `${todayEvents.length} agendados` : 'Nenhum agendado',
      icon: Calendar,
      color: 'emerald',
      link: 'Appointments'
    },
    {
      title: 'Animais',
      value: animals.length,
      subtitle: `${animals.length} total`,
      icon: null,
      color: 'blue',
      link: 'Animals',
      customIcon: (
        <img
          src="/icons8-gado-50.png"
          alt="Animais"
          className="w-6 h-6 object-contain"
        />
      )
    },
    {
      title: 'Clientes',
      value: totalClientsCount,
      subtitle: `${activeClientsCount} ativos (90 dias)`,
      icon: Users,
      color: 'blue',
      link: 'Clients'
    },
    {
      title: 'Faturamento do Mês',
      value: `R$ ${monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      subtitle: `${monthAppointments.length} atendimentos`,
      trend: revenueTrend,
      icon: DollarSign,
      color: 'darkGreen',
      link: 'Financial',
      isMain: true
    }
  ];

  const secondaryKpis = [
    {
      title: 'Propriedades',
      value: properties.length,
      icon: MapPin,
      color: 'emerald',
      link: 'Properties'
    },
    {
      title: 'Sem Nota Fiscal',
      value: withoutInvoice.length,
      icon: Receipt,
      color: withoutInvoice.length > 0 ? 'red' : 'green',
      link: 'Invoices'
    },
    {
      title: 'Retornos Pendentes',
      value: pendingReturnsCount,
      icon: AlertCircle,
      color: 'amber',
      link: 'Appointments'
    }
  ];

  const colorClasses = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200' },
    red: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-200' },
    green: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-200' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600', border: 'border-violet-200' },
    darkGreen: { bg: 'bg-[#064e3b]/10', text: 'text-[#064e3b]', border: 'border-[#064e3b]/20' }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'em_andamento': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'finalizado': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'faturado': return 'bg-violet-50 text-violet-700 border-violet-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTypeLabel = (type) => {
    const types = {
      clinico: 'Clínico',
      reprodutivo: 'Reprodutivo',
      cirurgico: 'Cirúrgico',
      sanitario: 'Sanitário',
      preventivo: 'Preventivo'
    };
    return types[type] || type;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header - iOS Style */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1.5 font-medium">
            {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h1 className="text-3xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Button 
            onClick={handleManualRefresh}
            disabled={isRefetching}
            variant="outline"
            className="w-full sm:w-auto bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] gap-2 h-12 md:h-11 px-4 rounded-2xl font-semibold"
          >
            <RotateCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="md:inline">Sincronizar</span>
          </Button>
          <Link to={createPageUrl('NewAppointment')} className="w-full sm:w-auto" data-onboarding="dashboard-new-appointment">
            <Button className="w-full sm:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 md:h-11 px-6 rounded-2xl font-semibold shadow-lg shadow-[var(--accent)]/25">
              <Plus className="w-5 h-5" />
              <span className="md:inline">Novo Atendimento</span>
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Primary KPI Cards - SaaS Style */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryKpis.map((kpi) => {
          const Icon = kpi.icon;
          const colors = colorClasses[kpi.color];
          return (
            <Link key={kpi.title} to={createPageUrl(kpi.link)}>
              <Card className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/30 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group h-full overflow-hidden ${kpi.isMain ? 'ring-2 ring-[#064e3b]/20 shadow-xl' : ''}`}>
                <CardContent className="p-4 sm:p-6 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${colors.bg} w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                      {kpi.customIcon ? kpi.customIcon : <Icon className={`w-6 h-6 ${colors.text}`} />}
                    </div>
                    {typeof kpi.trend === 'number' && (
                      <Badge className={`${kpi.trend < 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'} border-0 font-bold`}>
                        {kpi.trend > 0 ? `+${kpi.trend}%` : `${kpi.trend}%`}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className={`text-2xl sm:text-3xl font-bold tracking-tight mb-1 break-words ${kpi.isMain ? 'text-[#064e3b]' : 'text-[var(--text-primary)]'}`}>
                      {kpi.value}
                    </p>
                    <p className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      {kpi.title}
                    </p>
                    {kpi.subtitle && (
                      <p className="text-xs text-[var(--text-muted)] mt-2 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/40"></span>
                        {kpi.subtitle}
                      </p>
                    )}
                  </div>
                  {kpi.isMain && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#064e3b]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </motion.div>

      {/* Secondary KPI Cards - Compact Style */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {secondaryKpis.map((kpi) => {
          const Icon = kpi.icon;
          const colors = colorClasses[kpi.color];
          return (
            <Link key={kpi.title} to={createPageUrl(kpi.link)}>
              <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)]/30 hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`${colors.bg} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate">
                      {kpi.title}
                    </p>
                    <p className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                      {kpi.value}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-[var(--text-primary)]">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alertas e Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((alert, idx) => (
                  <Link key={idx} to={createPageUrl(alert.action)}>
                    <div className={`p-3 rounded-xl border transition-all cursor-pointer hover:border-[var(--accent)] ${
                      alert.type === 'error' ? 'bg-red-500/5 border-red-200' : 'bg-amber-500/5 border-amber-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        {alert.type === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-[var(--text-primary)] text-sm">
                            {alert.title}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {alert.description}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Grid - 70/30 Layout */}
      <div className="grid md:grid-cols-3 lg:grid-cols-10 gap-4 md:gap-6">
        {/* Agenda do Dia - 70% */}
        <motion.div variants={itemVariants} className="md:col-span-3 lg:col-span-7">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl h-full shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg flex items-center gap-2.5 text-[var(--text-primary)] font-bold">
                  <Calendar className="w-5 h-5 text-[var(--accent)]" />
                  Agenda de Hoje
                </CardTitle>
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <Badge className="bg-[var(--accent)] text-white border-0 px-2.5 py-0.5 rounded-lg font-bold">
                    {todayAppointments.length + todayEvents.length}
                  </Badge>
                  <Link to={createPageUrl('Agenda')}>
                    <Button variant="ghost" size="sm" className="text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 px-2 rounded-lg">
                      Ver tudo
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(todayAppointments.length + todayEvents.length) === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 sm:py-20 px-4 sm:px-6 text-center">
                  <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                    <Calendar className="w-10 h-10 text-[var(--text-muted)] opacity-50" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-2">Você ainda não possui atendimentos cadastrados</h3>
                  <p className="text-[var(--text-muted)] text-sm max-w-xs mb-6 sm:mb-8">Clique no botão abaixo para começar a organizar sua rotina.</p>
                  <Link to={createPageUrl('NewAppointment')}>
                    <Button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-11 px-6 rounded-xl font-bold shadow-lg shadow-[var(--accent)]/20">
                      <Plus className="w-5 h-5" />
                      Criar novo compromisso
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-color)]">
                  {todayAppointments.map((appt) => {
                    if (!appt) return null;
                    const appointmentIdentifier = appt.id || appt._id;
                    const apptClientId = getAppointmentClientId(appt);
                    const apptPropertyId = getAppointmentPropertyId(appt);
                    
                    const client = (clients || []).find(c => c && compareIds(c.id || c._id, apptClientId));
                    const property = (properties || []).find(p => p && compareIds(p.id || p._id, apptPropertyId));
                    return (
                      <div key={appointmentIdentifier} className="p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors group">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-xl flex flex-col items-center justify-center border border-[var(--border-color)] group-hover:border-[var(--accent)]/30 transition-colors">
                              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] leading-none mb-1">
                                {format(new Date(appt.date), 'MMM', { locale: ptBR })}
                              </span>
                              <span className="text-lg font-bold text-[var(--text-primary)] leading-none">
                                {format(new Date(appt.date), 'HH:mm')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${appt.status === 'em_andamento' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--accent)]'}`}></span>
                                <p className="font-bold text-[var(--text-primary)] text-sm truncate">
                                  {getTypeLabel(appt.type)}
                                </p>
                              </div>
                              <div className="text-xs text-[var(--text-muted)] font-medium space-y-1">
                                <div className="flex items-start gap-1.5 min-w-0">
                                  <Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">{client?.name || 'Cliente não especificado'}</span>
                                </div>
                                {property && (
                                  <div className="flex items-start gap-1.5 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    <span className="break-words">{property.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex w-full sm:w-auto items-center gap-2">
                            {appt.status === 'em_andamento' ? (
                              <Link to={createPageUrl('AppointmentDetail') + `?id=${appointmentIdentifier}`} className="w-full sm:w-auto">
                                <Button size="sm" className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white h-9 px-4 rounded-xl font-bold shadow-sm">
                                  <Play className="w-4 h-4 mr-1.5" />
                                  Continuar
                                </Button>
                              </Link>
                            ) : (
                              <Link to={createPageUrl('AppointmentDetail') + `?id=${appointmentIdentifier}`} className="w-full sm:w-auto">
                                <Button size="sm" variant="outline" className="w-full sm:w-auto h-9 px-4 rounded-xl text-[var(--text-primary)] bg-white border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] font-bold">
                                  <Eye className="w-4 h-4 mr-1.5" />
                                  Ver
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {todayEvents.filter(e => e.event_type !== 'atendimento').map((event) => (
                    <div key={event.id} className="p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors group">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="w-12 h-12 bg-violet-500/5 rounded-xl flex items-center justify-center border border-violet-500/10 group-hover:border-violet-500/30 transition-colors">
                          <Calendar className="w-6 h-6 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--text-primary)] text-sm mb-1 break-words">
                            {format(new Date(event.start_datetime), 'HH:mm')} - {event.title}
                          </p>
                          {event.location && (
                            <div className="text-xs text-[var(--text-muted)] font-medium flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <span className="break-words">{event.location}</span>
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="w-fit rounded-lg border-violet-500/20 text-violet-600 bg-violet-500/5 font-bold uppercase text-[10px]">
                          Evento
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Visão Financeira - 30% */}
        <motion.div variants={itemVariants} className="md:col-span-3 lg:col-span-3 space-y-4 md:space-y-6">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4 border-b border-[var(--border-color)]">
              <CardTitle className="text-lg flex items-center gap-2.5 text-[var(--text-primary)] font-bold">
                <DollarSign className="w-5 h-5 text-[var(--accent)]" />
                Financeiro Resumido
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <div className="flex items-end justify-between gap-3 mb-2">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Faturamento Total</p>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-black uppercase">Mensal</Badge>
                  </div>
                  <div className="flex items-baseline gap-1 min-w-0">
                    <span className="text-sm font-bold text-[var(--accent)]">R$</span>
                    <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tighter break-all">
                      {monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Mini Graph using Recharts */}
                <div className="h-20 sm:h-24 w-full bg-[var(--bg-tertiary)]/30 rounded-xl overflow-x-auto pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="var(--accent)" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2">
                  <div className="bg-[var(--bg-tertiary)]/50 p-3 rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-emerald-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Pago</span>
                    </div>
                    <p className="text-sm font-black text-[var(--text-primary)] truncate">
                      R$ {receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-[var(--bg-tertiary)]/50 p-3 rounded-xl border border-[var(--border-color)]">
                    <div className="flex items-center gap-1.5 mb-1.5 text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Aberto</span>
                    </div>
                    <p className="text-sm font-black text-[var(--text-primary)] truncate">
                      R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <Link to={createPageUrl('Financial')}>
                  <Button variant="outline" className="w-full mt-2 rounded-xl text-xs font-bold text-[var(--text-primary)] bg-white border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] h-10">
                    Acessar Gestão Financeira
                    <ArrowUpRight className="w-4 h-4 ml-2 opacity-50" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Retornos Pendentes */}
          <ReturnAlertsCard />
        </motion.div>
      </div>

      {/* Atalhos Rápidos */}
      <motion.div variants={itemVariants}>
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-[var(--text-primary)]">Atalhos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
              {[
                { icon: Stethoscope, label: 'Novo Atendimento', page: 'NewAppointment', color: 'accent' },
                {
                  icon: null,
                  label: 'Novo Animal',
                  page: 'Animals',
                  param: '?new=true',
                  color: 'emerald',
                  customIcon: (
                    <img
                      src="/icons8-gado-50.png"
                      alt="Animais"
                      className="w-5 h-5 object-contain"
                    />
                  )
                },
                { icon: Users, label: 'Novo Cliente', page: 'Clients', param: '?new=true', color: 'blue' },
                { icon: Receipt, label: 'Emitir NF', page: 'Invoices', color: 'violet' },
                { icon: Calendar, label: 'Agenda', page: 'Agenda', color: 'amber' }
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.page} to={createPageUrl(action.page) + (action.param || '')}>
                    <Button 
                      variant="outline" 
                      className="w-full min-h-[112px] h-auto py-4 px-3 flex flex-col gap-2 rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all group"
                    >
                      <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-xl flex items-center justify-center group-hover:bg-[var(--accent)]/10 transition-colors">
                        {action.customIcon ? action.customIcon : <Icon className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />}
                      </div>
                      <span className="text-xs font-medium text-center break-words text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                        {action.label}
                      </span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <QuickAppointment 
        isOpen={showQuickAppointment} 
        onClose={() => setShowQuickAppointment(false)} 
      />
    </motion.div>
  );
}
