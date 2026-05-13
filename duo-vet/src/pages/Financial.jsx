import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useAuth } from '../lib/AuthContextJWT';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Calendar as CalendarPicker } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
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
import {
  DollarSign,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  MoreVertical,
  Send,
  FileText,
  Download,
  PawPrint,
  MapPin,
  Trash2,
  Edit2,
  Plus,
  Receipt,
  RotateCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

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

const formatDisplayCurrency = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCurrencyInputBRL = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const amount = Number(digits) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

import { motion } from 'framer-motion';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import RevenueChart from '../components/financial/RevenueChart';
import ServiceTypeChart from '../components/financial/ServiceTypeChart';
import ServiceVsDisplacementChart from '../components/financial/ServiceVsDisplacementChart';
import PaymentStatusChart from '../components/financial/PaymentStatusChart';
import TopClientsChart from '../components/financial/TopClientsChart';
import AnimalIcon from '../components/animals/AnimalIcon';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import {
  getAppointmentClientId,
  getAppointmentPropertyId,
  normalizeAppointmentForAnalysis,
  parseAnimalIdsField
} from '../lib/appointments';
import { compareIds, formatCurrency } from '../lib/utils';
import { getSettings } from '../lib/api';
import { utils, writeFile } from 'xlsx';

export default function Financial() {
  const cancelButtonClass = "bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700 rounded-xl";
  const saveButtonClass = "bg-white border border-[#22c55e] text-black hover:bg-[#22c55e] dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90 rounded-xl";
  const initialSearchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialView = initialSearchParams?.get('view');
  const initialShowAll = initialSearchParams?.get('show') === 'all';
  const defaultView = initialView === 'expenses' ? 'expenses' : 'revenue';
  const [period, setPeriod] = useState('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterServiceType, setFilterServiceType] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState(defaultView);
  const [showAllRecords, setShowAllRecords] = useState(initialShowAll);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseFormData, setExpenseFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'outros',
    payment_method: 'pix',
    notes: ''
  });

  const getViewAndShowFromUrl = () => {
    if (typeof window === 'undefined') return { view: 'revenue', showAll: false };
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') === 'expenses' ? 'expenses' : 'revenue';
    const showAll = params.get('show') === 'all';
    return { view, showAll };
  };

  const updateFinancialUrl = (view, showAll) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', view === 'expenses' ? 'expenses' : 'revenue');
    if (showAll) {
      url.searchParams.set('show', 'all');
    } else {
      url.searchParams.delete('show');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

  useEffect(() => {
    updateFinancialUrl(activeView, showAllRecords);
  }, [activeView, showAllRecords]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      const { view, showAll } = getViewAndShowFromUrl();
      setActiveView(view);
      setShowAllRecords(showAll);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const parseYmdToDate = (value) => {
    if (!value || typeof value !== 'string') return undefined;
    const parts = value.split('-').map((p) => parseInt(p, 10));
    if (parts.length !== 3) return undefined;
    const [y, m, d] = parts;
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  };

  const toYmd = (date) => {
    if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const DatePickerField = ({ value, onChange, placeholder, className = '' }) => {
    const selected = parseYmdToDate(value);
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`w-full justify-start bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)] font-normal ${className}`}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
            {selected ? format(selected, 'dd/MM/yyyy') : <span className="text-[var(--text-muted)]">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-auto p-0 rounded-2xl border-[var(--border-color)] !bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]"
        >
          <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1">
            <CalendarPicker
              mode="single"
              selected={selected}
              onSelect={(date) => onChange(toYmd(date))}
              initialFocus
              className="rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)]"
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const queryClient = useQueryClient();
  const { user, token } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings
  });

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/appointments?created_by=${isAdmin ? '' : email}&sort=-date`);
    },
    enabled: !!user?.email
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/clients?created_by=${isAdmin ? '' : email}`);
    },
    enabled: !!user?.email
  });

  const { data: payments = [], refetch: refetchPayments, isRefetching: isRefetchingPayments } = useQuery({
    queryKey: ['payments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/payments?created_by=${isAdmin ? '' : email}&sort=-created_date`);
    },
    enabled: !!user?.email
  });

  const { data: expenses = [], refetch: refetchExpenses, isRefetching: isRefetchingExpenses } = useQuery({
    queryKey: ['expenses', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/expenses?created_by=${isAdmin ? '' : email}`);
    },
    enabled: !!user?.email
  });

  const { data: vetProfile, refetch: refetchVetProfile } = useQuery({
    queryKey: ['vetProfile', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const profiles = await offlineFetch(`/api/vetprofiles?created_by=${isAdmin ? '' : email}`);
      return profiles[0] || null;
    },
    enabled: !!user?.email
  });

  const { data: animals = [], refetch: refetchAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/animals?created_by=${isAdmin ? '' : email}`);
    },
    enabled: !!user?.email
  });

  const { data: properties = [], refetch: refetchProperties } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/properties?created_by=${isAdmin ? '' : email}`);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchAppointments(),
        refetchClients(),
        refetchPayments(),
        refetchExpenses(),
        refetchVetProfile(),
        refetchAnimals(),
        refetchProperties()
      ]),
      {
        loading: 'Atualizando dados financeiros...',
        success: 'Dados financeiros atualizados!',
        error: 'Erro ao atualizar dados'
      }
    );
  };

  const isRefetching = isRefetchingPayments || isRefetchingExpenses;

  const updatePaymentMutation = useMutation(/** @type {any} */({
    mutationFn: async ({ id, data }) => {
      return await enqueueMutation(`/api/payments/${id}`, { 
        method: 'PUT', 
        body: { ...data, created_by: user?.email } 
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['appointments', user?.email] });
      toast.success('Pagamento atualizado!');
      setSelectedPayment(null);
    },
    onError: (error) => {
      console.error('[Financial] Error updating payment:', error);
      toast.error('Erro ao atualizar pagamento');
    }
  }));

  const createPaymentMutation = useMutation(/** @type {any} */({
    mutationFn: async (data) => {
      return await enqueueMutation('/api/payments', {
        method: 'POST',
        body: {
          ...data,
          created_by: user?.email
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payments', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['appointments', user?.email] });
      toast.success('Pagamento registrado!');
      setSelectedPayment(null);
    },
    onError: () => {
      toast.error('Erro ao registrar pagamento');
    }
  }));

  const expenseMutation = useMutation(/** @type {any} */({
    mutationFn: async (data) => {
      const { id, ...body } = data;
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/expenses/${id}` : '/api/expenses';
      return await enqueueMutation(url, { 
        method, 
        body: { ...body, created_by: user?.email } 
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses', user?.email] });
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      setExpenseFormData({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'outros',
        payment_method: 'pix',
        notes: ''
      });
      toast.success(editingExpense ? 'Despesa atualizada!' : 'Despesa registrada!');
    },
    onError: () => {
      toast.error('Erro ao salvar despesa');
    }
  }));

  const deleteExpenseMutation = useMutation(/** @type {any} */({
    mutationFn: async (id) => {
      return await enqueueMutation(`/api/expenses/${id}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses', user?.email] });
      toast.success('Despesa excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir despesa');
    }
  }));

  const getDateRange = () => {
    const today = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'custom':
        if (customDateFrom && customDateTo) {
          return { start: new Date(customDateFrom), end: new Date(customDateTo + 'T23:59:59') };
        }
        return { start: startOfMonth(today), end: endOfMonth(today) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const dateRange = getDateRange();
  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  
  // Calcular lançamentos do período
  const periodAppointments = normalizedAppointments.filter(a => {
    if (!a?.date) return false;
    try {
      const appointmentDate = new Date(a.date);
      if (!isValid(appointmentDate)) return false;
      return isWithinInterval(appointmentDate, dateRange) && 
             (a.status === 'finalizado' || a.status === 'faturado');
    } catch (e) {
      return false;
    }
  });

  const periodPayments = (payments || []).filter(p => {
    if (!p?.due_date) return false;
    try {
      const dueDate = new Date(p.due_date);
      if (!isValid(dueDate)) return false;
      return isWithinInterval(dueDate, dateRange);
    } catch (e) {
      return false;
    }
  });

  const periodExpenses = (expenses || []).filter(e => {
    if (!e?.date) return false;
    try {
      const expenseDate = new Date(e.date);
      if (!isValid(expenseDate)) return false;
      return isWithinInterval(expenseDate, dateRange);
    } catch (e) {
      return false;
    }
  });

  const totalRevenue = periodAppointments.reduce((sum, a) => sum + toNumber(a.total_amount), 0);
  const totalDisplacement = periodAppointments.reduce((sum, a) => sum + toNumber(a.displacement_cost), 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const netIncome = totalRevenue - totalExpenses;
  const appointmentsCount = periodAppointments.length;
  
  const receivedAmount = periodPayments.reduce((sum, payment) => {
    const total = toNumber(payment?.amount);
    const rawPaid = toNumber(payment?.amount_paid);
    const normalizedPaid = payment?.status === 'pago' && rawPaid <= 0
      ? total
      : Math.max(0, Math.min(rawPaid, total || rawPaid));
    return sum + normalizedPaid;
  }, 0);

  const pendingAmount = periodPayments.reduce((sum, payment) => {
    const total = toNumber(payment?.amount);
    const rawPaid = toNumber(payment?.amount_paid);
    const normalizedPaid = payment?.status === 'pago' && rawPaid <= 0
      ? total
      : Math.max(0, Math.min(rawPaid, total || rawPaid));
    return sum + Math.max(0, total - normalizedPaid);
  }, 0);

  const monthlyGoal = toNumber(settings?.monthly_goal);
  const goalProgress = monthlyGoal > 0 ? (totalRevenue / monthlyGoal) * 100 : 0;

  // Filtros e helpers
  const getClientName = (clientId) => (clients || []).find(c => c && compareIds(c.id || c._id, clientId))?.name || '-';
  const getPropertyName = (propertyId) => (properties || []).find(p => p && compareIds(p.id || p._id, propertyId))?.name || '-';
  const getAnimalNames = (animalIds) => {
    const parsedIds = parseAnimalIdsField(animalIds);
    if (parsedIds.length === 0) return '-';
    return parsedIds.map(id => (animals || []).find(a => a && compareIds(a.id || a._id, id))?.name || '-').join(', ');
  };
  const getAnimalSpecies = (animalIds) => {
    const parsedIds = parseAnimalIdsField(animalIds);
    if (parsedIds.length === 0) return '';
    const speciesList = parsedIds
      .map((id) => (animals || []).find((animal) => animal && compareIds(animal.id || animal._id, id))?.species)
      .map((species) => (species ? String(species).toLowerCase() : ''))
      .filter(Boolean);
    if (speciesList.length === 0) return '';
    return speciesList[0];
  };

  // Criar registros financeiros a partir dos atendimentos
  const financialRecords = periodAppointments.map(appt => {
    const payment = (payments || []).find(p => p && compareIds(p.appointment_id, appt.id || appt._id));
    const totalAmount = toNumber(appt.total_amount);
    const rawPaid = toNumber(payment?.amount_paid);
    const amountPaid = payment?.status === 'pago' && rawPaid <= 0
      ? totalAmount
      : Math.max(0, Math.min(rawPaid, totalAmount || rawPaid));
    const normalizedStatus = amountPaid >= totalAmount && totalAmount > 0
      ? 'pago'
      : amountPaid > 0
        ? 'parcial'
        : (payment?.status || 'pendente');
    return {
      id: appt.id,
      date: appt.date,
      client_id: getAppointmentClientId(appt),
      property_id: getAppointmentPropertyId(appt),
      animal_ids: parseAnimalIdsField(appt.animal_ids),
      type: appt.type,
      serviceAmount: toNumber(appt.total_procedures) + toNumber(appt.total_medications),
      displacementAmount: toNumber(appt.displacement_cost),
      totalAmount,
      amountPaid,
      remainingAmount: Math.max(0, totalAmount - amountPaid),
      status: normalizedStatus,
      payment_date: payment?.payment_date,
      payment,
      appointment: appt
    };
  });

  const filteredRecords = financialRecords.filter(record => {
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, record.client_id));
    const matchesSearch = !searchTerm || 
      client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAnimalNames(record.animal_ids).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    const matchesClient = filterClient === 'all' || compareIds(record.client_id, filterClient);
    const matchesServiceType = filterServiceType === 'all' || record.type === filterServiceType;
    return matchesSearch && matchesStatus && matchesClient && matchesServiceType;
  });

  const activeFiltersCount = [filterStatus, filterClient, filterServiceType, customDateFrom, customDateTo]
    .filter(f => f && f !== 'all').length;
  const sortedRevenueRecords = [...filteredRecords].sort(
    (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
  );
  const sortedExpenseRecords = [...periodExpenses].sort(
    (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
  );
  const visibleRevenueRecords = showAllRecords ? sortedRevenueRecords : sortedRevenueRecords.slice(0, 5);
  const visibleExpenseRecords = showAllRecords ? sortedExpenseRecords : sortedExpenseRecords.slice(0, 5);
  const hasMoreRevenueRecords = sortedRevenueRecords.length > 5;
  const hasMoreExpenseRecords = sortedExpenseRecords.length > 5;

  // Preparar dados para os gráficos
  const prepareRevenueChartData = () => {
    const dataMap = new Map();
    
    periodAppointments.forEach(appt => {
      const dateKey = format(new Date(appt.date), 'yyyy-MM-dd');
      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, { date: dateKey, value: 0, count: 0 });
      }
      const entry = dataMap.get(dateKey);
      entry.value += toNumber(appt.total_amount);
      entry.count += 1;
    });

    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const prepareServiceTypeData = () => {
    const serviceMap = new Map();
    const total = periodAppointments.reduce((sum, a) => sum + toNumber(a.total_amount), 0);

    periodAppointments.forEach(appt => {
      const type = appt.type || 'clinico';
      if (!serviceMap.has(type)) {
        serviceMap.set(type, { type, value: 0, count: 0 });
      }
      const entry = serviceMap.get(type);
      entry.value += toNumber(appt.total_amount);
      entry.count += 1;
    });

    return Array.from(serviceMap.values()).map(item => ({
      ...item,
      total
    }));
  };

  const prepareServiceVsDisplacementData = () => {
    const dataMap = new Map();

    periodAppointments.forEach(appt => {
      const client = getClientName(getAppointmentClientId(appt));
      if (!dataMap.has(client)) {
        dataMap.set(client, { name: client, service: 0, displacement: 0 });
      }
      const entry = dataMap.get(client);
      entry.service += toNumber(appt.total_procedures) + toNumber(appt.total_medications);
      entry.displacement += toNumber(appt.displacement_cost);
    });

    return Array.from(dataMap.values())
      .sort((a, b) => (b.service + b.displacement) - (a.service + a.displacement))
      .slice(0, 10);
  };

  const preparePaymentStatusData = () => {
    const statusMap = new Map();

    financialRecords.forEach(record => {
      const status = record.status || 'pendente';
      if (!statusMap.has(status)) {
        statusMap.set(status, { status, value: 0, count: 0 });
      }
      const entry = statusMap.get(status);
      entry.value += record.totalAmount;
      entry.count += 1;
    });

    return Array.from(statusMap.values());
  };

  const prepareTopClientsData = () => {
    const clientMap = new Map();

    periodAppointments.forEach(appt => {
      const clientId = getAppointmentClientId(appt);
      const clientName = getClientName(clientId);
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { id: clientId, name: clientName, value: 0, count: 0 });
      }
      const entry = clientMap.get(clientId);
      entry.value += toNumber(appt.total_amount);
      entry.count += 1;
    });

    return Array.from(clientMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  const revenueChartData = prepareRevenueChartData();
  const serviceTypeData = prepareServiceTypeData();
  const serviceVsDisplacementData = prepareServiceVsDisplacementData();
  const paymentStatusData = preparePaymentStatusData();
  const topClientsData = prepareTopClientsData();

  // Handlers para cliques nos gráficos
  const handleServiceTypeClick = (type) => {
    setFilterServiceType(type);
    toast.success(`Filtrado por: ${serviceTypeLabels[type] || type}`);
  };

  const handleStatusClick = (status) => {
    setFilterStatus(status);
    const statusLabel = status === 'pago' ? 'Pagos' : status === 'parcial' ? 'Parciais' : 'Pendentes';
    toast.success(`Filtrado por: ${statusLabel}`);
  };

  const handleClientClick = (data) => {
    if (data?.id) {
      setFilterClient(data.id);
      toast.success(`Filtrado por cliente: ${data.name}`);
    }
  };

  const handleShowAllForView = (view) => {
    const nextView = view === 'expenses' ? 'expenses' : 'revenue';
    setActiveView(nextView);
    setShowAllRecords(true);
    updateFinancialUrl(nextView, true);
  };

  const openPaymentDialog = (record) => {
    if (!record) return;
    const existingPayment = (payments || []).find(p => p && compareIds(p.appointment_id, record.id || record._id));
    const totalAmount = toNumber(record.totalAmount);
    const initialPaid = toNumber(record.amountPaid);
    const paymentType = initialPaid >= totalAmount && totalAmount > 0 ? 'integral' : 'parcial';

    setSelectedPayment({
      record,
      existingPayment,
      totalAmount,
      paymentType,
      amountPaidInput: formatCurrencyInputBRL(initialPaid > 0 ? String(initialPaid) : ''),
      paymentDate: existingPayment?.payment_date
        ? new Date(existingPayment.payment_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    });
  };

  const handleSubmitPayment = async () => {
    if (!selectedPayment?.record) return;

    const totalAmount = toNumber(selectedPayment.totalAmount);
    const paidAmount = selectedPayment.paymentType === 'integral'
      ? totalAmount
      : toNumber(selectedPayment.amountPaidInput);

    if (paidAmount <= 0) {
      toast.error('Informe um valor pago maior que zero');
      return;
    }

    if (paidAmount > totalAmount) {
      toast.error('Valor pago não pode ser maior que o valor total');
      return;
    }

    const status = paidAmount >= totalAmount ? 'pago' : 'parcial';
    const dueDate = selectedPayment?.existingPayment?.due_date
      ? new Date(selectedPayment.existingPayment.due_date).toISOString().split('T')[0]
      : selectedPayment.record.date;
    const payload = {
      appointment_id: selectedPayment.record.id,
      client_id: selectedPayment.record.client_id,
      amount: totalAmount,
      amount_paid: paidAmount,
      status,
      payment_date: selectedPayment.paymentDate || new Date().toISOString().split('T')[0],
      due_date: dueDate
    };

    if (selectedPayment?.existingPayment?.id) {
      updatePaymentMutation.mutate(/** @type {any} */ ({
        id: selectedPayment.existingPayment.id,
        data: payload
      }));
      return;
    }

    createPaymentMutation.mutate(payload);
  };

  const handleSendWhatsApp = (record) => {
    if (!record) return;
    const client = (clients || []).find(c => c && compareIds(c.id || c._id, record.client_id));
    if (!client?.phone) {
      toast.error('Cliente não possui WhatsApp cadastrado');
      return;
    }
    
    let message = `Olá ${client.name}! 👋\n\n`;
    message += `Cobrança do atendimento realizado em ${safeFormatDate(record.date, "dd/MM/yyyy")}.\n\n`;
    message += `*Valor Total: R$ ${toNumber(record.totalAmount).toFixed(2)}*\n\n`;
    
    if (vetProfile?.pix_key) {
      message += `*Dados para Pagamento:*\n`;
      message += `PIX: ${vetProfile.pix_key}\n\n`;
    }
    
    message += `Qualquer dúvida, estou à disposição!`;
    
    const whatsappUrl = `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('WhatsApp aberto');
  };

  const handleMonthlyExport = (formatType = 'xlsx') => {
    const dataToExport = activeView === 'revenue' ? filteredRecords : periodExpenses;
    if (dataToExport.length === 0) {
      toast.error('Nenhum dado para exportar no período selecionado');
      return;
    }

    const fileName = `exportacao_${activeView}_${format(dateRange.start, 'yyyy-MM-dd')}_a_${format(dateRange.end, 'yyyy-MM-dd')}`;

    if (formatType === 'csv') {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (activeView === 'revenue') {
        csvContent += "Data,Cliente,Tipo,Servico,Deslocamento,Total,Status\n";
        dataToExport.forEach(r => {
          const row = [
            safeFormatDate(r.date, 'dd/MM/yyyy'),
            getClientName(r.client_id),
            (serviceTypeLabels || {})[r.type] || r.type,
            toNumber(r.serviceAmount).toFixed(2),
            toNumber(r.displacementAmount).toFixed(2),
            toNumber(r.totalAmount).toFixed(2),
            r.status
          ].join(",");
          csvContent += row + "\n";
        });
      } else {
        csvContent += "Data,Descricao,Categoria,Meio de Pagamento,Valor,Notas\n";
        dataToExport.forEach(e => {
          const row = [
            safeFormatDate(e.date, 'dd/MM/yyyy'),
            e.description,
            (expenseCategoryLabels || {})[e.category] || e.category,
            (paymentMethodLabels || {})[e.payment_method] || e.payment_method,
            e.amount,
            e.notes || ""
          ].join(",");
          csvContent += row + "\n";
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exportação CSV gerada com sucesso!');
    } else if (formatType === 'xlsx') {
      const exportData = dataToExport.map(item => {
        if (activeView === 'revenue') {
          return {
            'Data': safeFormatDate(item.date, 'dd/MM/yyyy'),
            'Cliente': getClientName(item.client_id),
            'Tipo': (serviceTypeLabels || {})[item.type] || item.type,
            'Serviço (R$)': toNumber(item.serviceAmount),
            'Deslocamento (R$)': toNumber(item.displacementAmount),
            'Total (R$)': toNumber(item.totalAmount),
            'Status': item.status === 'pago' ? 'Pago' : item.status === 'parcial' ? 'Parcial' : 'Pendente',
            'Valor Pago (R$)': toNumber(item.amountPaid),
            'Valor Pendente (R$)': toNumber(item.remainingAmount)
          };
        } else {
          return {
            'Data': safeFormatDate(item.date, 'dd/MM/yyyy'),
            'Descrição': item.description,
            'Categoria': (expenseCategoryLabels || {})[item.category] || item.category,
            'Meio de Pagamento': (paymentMethodLabels || {})[item.payment_method] || item.payment_method,
            'Valor (R$)': toNumber(item.amount),
            'Notas': item.notes || ""
          };
        }
      });

      const worksheet = utils.json_to_sheet(exportData);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, activeView === 'revenue' ? 'Receitas' : 'Despesas');
      
      // Auto-size columns
      const maxWidths = {};
      exportData.forEach(row => {
        Object.keys(row).forEach(key => {
          const value = row[key] ? row[key].toString() : '';
          maxWidths[key] = Math.max(maxWidths[key] || key.length, value.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxWidths).map(key => ({ wch: maxWidths[key] + 2 }));

      writeFile(workbook, `${fileName}.xlsx`);
      toast.success('Exportação Excel gerada com sucesso!');
    }
  };

  const getStatusConfig = (status) => {
    if (status === 'pago') {
      return {
        label: 'Pago',
        color: 'bg-[#22c55e]/10 text-[#16a34a]',
        icon: CheckCircle
      };
    }
    if (status === 'parcial') {
      return {
        label: 'Parcial',
        color: 'bg-blue-500/10 text-blue-600',
        icon: AlertCircle
      };
    }
    return {
      label: 'Pendente',
      color: 'bg-amber-500/10 text-amber-600',
      icon: Clock
    };
  };

  const serviceTypeLabels = {
    clinico: 'Clínico',
    reprodutivo: 'Reprodutivo',
    cirurgico: 'Cirúrgico',
    sanitario: 'Sanitário',
    preventivo: 'Preventivo',
    consultoria: 'Consultoria'
  };

  const expenseCategoryLabels = {
    medicamentos: 'Medicamentos',
    combustivel: 'Combustível',
    equipamentos: 'Equipamentos',
    marketing: 'Marketing',
    aluguel: 'Aluguel/Sede',
    impostos: 'Impostos/Taxas',
    'pro-labore': 'Pró-labore',
    outros: 'Outros'
  };

  const paymentMethodLabels = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    transferencia: 'Transferência'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Financeiro</h1>
          <p className="text-[var(--text-muted)] mt-1">Controle financeiro dos atendimentos, consultorias e serviços</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            disabled={isRefetching}
            className={`w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold ${isRefetching ? 'animate-pulse' : ''}`}
          >
            <RotateCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="today">Hoje</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === 'custom' && (
            <>
              <DatePickerField
                value={customDateFrom}
                onChange={setCustomDateFrom}
                placeholder="Data inicial"
                className="w-40 h-12 rounded-xl"
              />
              <DatePickerField
                value={customDateTo}
                onChange={setCustomDateTo}
                placeholder="Data final"
                className="w-40 h-12 rounded-xl"
              />
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-xl flex items-center justify-center shadow-md">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Receita Total</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Despesas Totais</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className={`text-2xl md:text-3xl font-bold ${netIncome >= 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>
              R$ {netIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Saldo Líquido</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">A Receber (Pendentes)</p>
          </CardContent>
        </Card>
      </div>

      {/* Meta Mensal (Only show if period is month or custom, and goal is set) */}
      {(period === 'month' || (period === 'custom' && monthlyGoal > 0)) && monthlyGoal > 0 && (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
                  Meta de Receita Mensal
                </h3>
                <p className="text-sm text-[var(--text-muted)]">Acompanhamento da sua meta de faturamento</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--text-muted)]">Progresso: <span className="font-bold text-[var(--text-primary)]">{goalProgress.toFixed(1)}%</span></p>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="w-full h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(goalProgress, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${goalProgress >= 100 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-[var(--accent)] to-blue-500'}`}
              />
            </div>
            {goalProgress >= 100 && (
              <p className="text-xs text-green-500 mt-2 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Meta atingida! Parabéns!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] w-fit">
          <button
            onClick={() => {
              setActiveView('revenue');
              setShowAllRecords(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'revenue' 
                ? 'bg-[var(--accent)] text-white shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Receitas
          </button>
          <button
            onClick={() => {
              setActiveView('expenses');
              setShowAllRecords(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'expenses' 
                ? 'bg-[var(--accent)] text-white shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Despesas
          </button>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl h-11 border-[var(--border-color)] gap-2">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-48">
              <DropdownMenuItem onClick={() => handleMonthlyExport('xlsx')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMonthlyExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {activeView === 'expenses' && (
            <Button 
              onClick={() => {
                setEditingExpense(null);
                setExpenseFormData({
                  description: '',
                  amount: '',
                  date: new Date().toISOString().split('T')[0],
                  category: 'outros',
                  payment_method: 'pix',
                  notes: ''
                });
                setIsExpenseModalOpen(true);
              }}
              className="bg-[var(--accent)] hover:opacity-90 text-white rounded-xl h-11"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nova Despesa
            </Button>
          )}
        </div>
      </div>

      {/* Filters - Desktop */}
      {activeView === 'revenue' && (
        <Card className="hidden md:block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
        <CardContent className="p-6">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${period === 'custom' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            <div>
              <Label className="text-sm mb-2">Cliente</Label>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Tipo de Serviço</Label>
              <select
                value={filterServiceType}
                onChange={(e) => setFilterServiceType(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                <option value="clinico">Atendimento</option>
                <option value="consultoria">Consultoria</option>
                <option value="reprodutivo">Reprodutivo</option>
                <option value="cirurgico">Cirúrgico</option>
                <option value="sanitario">Sanitário</option>
                <option value="preventivo">Preventivo</option>
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Status</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                <option value="pago">Pago</option>
                <option value="parcial">Parcial</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Buscar</Label>
              <Input
                placeholder="Cliente, animal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
              />
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <Label className="text-sm mb-2">Data inicial</Label>
                  <DatePickerField
                    value={customDateFrom}
                    onChange={setCustomDateFrom}
                    placeholder="Data inicial"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2">Data final</Label>
                  <DatePickerField
                    value={customDateTo}
                    onChange={setCustomDateTo}
                    placeholder="Data final"
                    className="h-11 rounded-xl"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Mobile Filter Button */}
      {activeView === 'revenue' && (
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
      )}

      {/* Mobile Filter Drawer */}
      {activeView === 'revenue' && (
        <MobileFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          activeFiltersCount={activeFiltersCount}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2">Cliente</Label>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Tipo de Serviço</Label>
              <select
                value={filterServiceType}
                onChange={(e) => setFilterServiceType(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                <option value="clinico">Atendimento</option>
                <option value="consultoria">Consultoria</option>
                <option value="reprodutivo">Reprodutivo</option>
                <option value="cirurgico">Cirúrgico</option>
                <option value="sanitario">Sanitário</option>
                <option value="preventivo">Preventivo</option>
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Status</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">Todos</option>
                <option value="pago">Pago</option>
                <option value="parcial">Parcial</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Buscar</Label>
              <Input
                placeholder="Cliente, animal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
              />
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <Label className="text-sm mb-2">Data inicial</Label>
                  <DatePickerField
                    value={customDateFrom}
                    onChange={setCustomDateFrom}
                    placeholder="Data inicial"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2">Data final</Label>
                  <DatePickerField
                    value={customDateTo}
                    onChange={setCustomDateTo}
                    placeholder="Data final"
                    className="h-11 rounded-xl"
                  />
                </div>
              </>
            )}
          </div>
        </MobileFilterDrawer>
      )}

      {/* Financial Records List */}
      {activeView === 'revenue' ? (
        filteredRecords.length === 0 ? (
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-primary)] font-semibold text-lg">Nenhuma receita encontrada</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Nenhum registro de atendimento no período selecionado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {visibleRevenueRecords.map((record, index) => {
              const statusConfig = getStatusConfig(record.status);
              const StatusIcon = statusConfig.icon;
              const animalSpecies = getAnimalSpecies(record.animal_ids);

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/40 transition-all group">
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Icon + Main Info */}
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                            <DollarSign className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                {getClientName(record.client_id)}
                              </h3>
                              <Badge className={`${statusConfig.color} border-0 text-xs`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                              <Badge className="bg-blue-500/10 text-blue-600 border-0 text-xs">
                                {serviceTypeLabels[record.type] || record.type}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)] mb-2">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span>{format(new Date(record.date), 'dd/MM/yyyy')}</span>
                              </div>
                              {record.animal_ids && record.animal_ids.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  {animalSpecies ? (
                                    <AnimalIcon
                                      species={animalSpecies}
                                      className="w-3.5 h-3.5"
                                      white={false}
                                    />
                                  ) : (
                                    <PawPrint className="w-3.5 h-3.5" />
                                  )}
                                  <span>{getAnimalNames(record.animal_ids)}</span>
                                </div>
                              )}
                              {record.property_id && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>{getPropertyName(record.property_id)}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              <div>
                                <span className="text-[var(--text-muted)]">Serviço: </span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  R$ {toNumber(record.serviceAmount).toFixed(2)}
                                </span>
                              </div>
                              {toNumber(record.displacementAmount) > 0 && (
                                <div>
                                  <span className="text-[var(--text-muted)]">Deslocamento: </span>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    R$ {toNumber(record.displacementAmount).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-[var(--text-muted)]">Total: </span>
                                <span className="font-bold text-[#22c55e] text-base">
                                  R$ {toNumber(record.totalAmount).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-muted)]">Pago: </span>
                                <span className="font-semibold text-blue-600">
                                  R$ {toNumber(record.amountPaid).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-muted)]">Pendente: </span>
                                <span className="font-semibold text-amber-600">
                                  R$ {toNumber(record.remainingAmount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 md:ml-auto">
                          <Button
                            size="sm"
                            className={`${saveButtonClass} h-9 px-3 rounded-lg`}
                            onClick={() => openPaymentDialog(record)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {record.status === 'pago' ? 'Editar Pagto' : 'Registrar Pagto'}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem asChild>
                                <Link to={createPageUrl('AppointmentDetail') + `?id=${record.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Visualizar Atendimento
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={createPageUrl('AppointmentDetail') + `?id=${record.id}&action=pdf`}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Ver Relatório
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendWhatsApp(record)}>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar Cobrança
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            {!showAllRecords && hasMoreRevenueRecords && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl border-[var(--border-color)]"
                onClick={() => handleShowAllForView('revenue')}
              >
                Ver mais receitas
              </Button>
            )}
          </div>
        )
      ) : (
        /* Expenses List */
        periodExpenses.length === 0 ? (
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-[var(--text-primary)] font-semibold text-lg">Nenhuma despesa encontrada</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Clique em "+ Nova Despesa" para registrar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {visibleExpenseRecords.map((expense, index) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-red-500/40 transition-all group">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-red-600 transition-colors">
                              {expense.description}
                            </h3>
                            <Badge className="bg-red-500/10 text-red-600 border-0 text-xs">
                              {expenseCategoryLabels[expense.category] || expense.category}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>{format(new Date(expense.date), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{paymentMethodLabels[expense.payment_method] || expense.payment_method}</span>
                            </div>
                            {expense.notes && (
                              <div className="flex items-center gap-1.5 max-w-xs truncate">
                                <FileText className="w-3.5 h-3.5" />
                                <span>{expense.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">
                            - R$ {toNumber(expense.amount).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg hover:bg-blue-500/10 hover:text-blue-600"
                          onClick={() => {
                            setEditingExpense(expense);
                            setExpenseFormData({
                              description: expense.description,
                              amount: formatCurrency(expense.amount),
                              date: new Date(expense.date).toISOString().split('T')[0],
                              category: expense.category,
                              payment_method: expense.payment_method,
                              notes: expense.notes || ''
                            });
                            setIsExpenseModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => {
                            setExpenseToDelete(expense);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {!showAllRecords && hasMoreExpenseRecords && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl border-[var(--border-color)]"
                onClick={() => handleShowAllForView('expenses')}
              >
                Ver mais despesas
              </Button>
            )}
          </div>
        )
      )}

      <div className="space-y-6">
        <RevenueChart 
          data={revenueChartData} 
          period={period}
          onDataClick={(data) => data && toast.info(`${format(new Date(data.activePayload[0].payload.date), 'dd/MM/yyyy')}: R$ ${toNumber(data.activePayload[0].value).toFixed(2)}`)}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ServiceTypeChart 
            data={serviceTypeData}
            onServiceClick={handleServiceTypeClick}
          />
          <PaymentStatusChart 
            data={paymentStatusData}
            onStatusClick={handleStatusClick}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ServiceVsDisplacementChart 
            data={serviceVsDisplacementData}
            onBarClick={(data) => data && toast.info(`${data.activePayload[0].payload.name}`)}
          />
          <TopClientsChart 
            data={topClientsData}
            onClientClick={handleClientClick}
          />
        </div>
      </div>

      {/* Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={expenseFormData.description}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                placeholder="Ex: Combustível, Vacinas..."
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  value={expenseFormData.amount}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: formatDisplayCurrency(e.target.value) })}
                  placeholder="0,00"
                  className="rounded-xl"
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseFormData.date}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  value={expenseFormData.category}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  className="w-full h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 text-sm"
                >
                  {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_method">Meio de Pagamento</Label>
                <select
                  id="payment_method"
                  value={expenseFormData.payment_method}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, payment_method: e.target.value })}
                  className="w-full h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 text-sm"
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Input
                id="notes"
                value={expenseFormData.notes}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                placeholder="Detalhes adicionais..."
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExpenseModalOpen(false)}
              className={cancelButtonClass}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!expenseFormData.description || !expenseFormData.amount) {
                  toast.error('Preencha os campos obrigatórios');
                  return;
                }
                expenseMutation.mutate(/** @type {any} */ ({
                  ...expenseFormData,
                  amount: toNumber(expenseFormData.amount),
                  id: editingExpense?.id,
                  created_by: user?.email
                }));
              }}
              className={saveButtonClass}
              disabled={expenseMutation.isPending}
            >
              {expenseMutation.isPending ? 'Salvando...' : 'Salvar Despesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedPayment?.record && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-tertiary)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  {getClientName(selectedPayment.record.client_id)}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Total: R$ {toNumber(selectedPayment.totalAmount).toFixed(2)}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Pendente atual: R$ {Math.max(0, toNumber(selectedPayment.totalAmount) - toNumber(selectedPayment.record.amountPaid)).toFixed(2)}
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Tipo de Pagamento</Label>
                <select
                  value={selectedPayment.paymentType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setSelectedPayment((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        paymentType: nextType,
                        amountPaidInput: nextType === 'integral'
                          ? formatCurrencyInputBRL(String(prev.totalAmount))
                          : prev.amountPaidInput
                      };
                    });
                  }}
                  className="w-full h-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="integral">Integral</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Valor Pago (R$)</Label>
                <Input
                  value={selectedPayment.paymentType === 'integral' ? formatCurrencyInputBRL(String(selectedPayment.totalAmount)) : selectedPayment.amountPaidInput}
                  onChange={(e) => {
                    const nextValue = formatCurrencyInputBRL(e.target.value);
                    setSelectedPayment((prev) => prev ? { ...prev, amountPaidInput: nextValue } : prev);
                  }}
                  placeholder="R$ 0,00"
                  className="rounded-xl"
                  inputMode="numeric"
                  disabled={selectedPayment.paymentType === 'integral'}
                />
              </div>

              <div className="grid gap-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={selectedPayment.paymentDate}
                  onChange={(e) => setSelectedPayment((prev) => prev ? { ...prev, paymentDate: e.target.value } : prev)}
                  className="rounded-xl"
                />
              </div>

              <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <p className="text-sm text-[var(--text-muted)]">
                  Restante pendente: <span className="font-semibold text-[var(--text-primary)]">
                    R$ {Math.max(0, toNumber(selectedPayment.totalAmount) - (selectedPayment.paymentType === 'integral' ? toNumber(selectedPayment.totalAmount) : toNumber(selectedPayment.amountPaidInput))).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayment(null)} className={cancelButtonClass}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitPayment}
              className={saveButtonClass}
              disabled={updatePaymentMutation.isPending || createPaymentMutation.isPending}
            >
              {(updatePaymentMutation.isPending || createPaymentMutation.isPending) ? 'Salvando...' : 'Salvar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 
       {/* Delete Confirmation Dialog */}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <AlertDialogContent className="rounded-2xl">
           <AlertDialogHeader>
             <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
             <AlertDialogDescription>
               Tem certeza que deseja excluir a despesa "{expenseToDelete?.description}"? Esta ação não pode ser desfeita.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
            <AlertDialogCancel className="bg-white border border-black text-black hover:bg-gray-100 rounded-xl">Cancelar</AlertDialogCancel>
             <AlertDialogAction
               onClick={() => {
                 if (expenseToDelete) {
                   deleteExpenseMutation.mutate(expenseToDelete.id);
                   setIsDeleteDialogOpen(false);
                 }
               }}
               className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
             >
               Excluir
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
 
       {/* PIX Info Card */}
      {vetProfile && vetProfile.pix_key && (
        <Card className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#22c55e]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-[#22c55e]" />
            </div>
            <div className="text-sm flex-1">
              <p className="font-medium text-[var(--text-primary)]">Chave PIX configurada</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {vetProfile.pix_key}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!vetProfile?.pix_key && (
        <Card className="bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">Configure sua chave PIX</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Adicione uma chave PIX no seu perfil para facilitar o recebimento
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Old Payment Dialog */}
      {filteredRecords.length === 0 && (
        <div />
      )}
    </div>
  );
}
