import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
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
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Receipt,
  FileText,
  DollarSign,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Eye,
  Download,
  Send,
  XCircle,
  Clock,
  FileCheck,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import { compareIds } from '../lib/utils';
import { normalizeAppointmentForAnalysis } from '../lib/appointments';

import JSZip from 'jszip';
import { utils, writeFile } from 'xlsx';

const isValidDate = (date) => date && !isNaN(new Date(date).getTime());

const formatDate = (date, formatStr = "d 'de' MMM 'de' yyyy") => {
  if (!isValidDate(date)) return '-';
  try {
    return format(new Date(date), formatStr, { locale: ptBR });
  } catch (e) {
    return '-';
  }
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTimestamp = (date) => {
  if (!isValidDate(date)) return 0;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export default function Invoices() {
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [showNFDialog, setShowNFDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [activeTab, setActiveTab] = useState('unbilled');
  const lastBillingRef = React.useRef(null);
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      return offlineFetch(`/api/invoices${query}`);
    },
    enabled: !!user?.email
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      return offlineFetch(`/api/appointments${query}`);
    },
    enabled: !!user?.email
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      return offlineFetch(`/api/payments${query}`);
    },
    enabled: !!user?.email
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      return offlineFetch(`/api/clients${query}`);
    },
    enabled: !!user?.email
  });

  const normalizedAppointments = React.useMemo(
    () => (appointments || []).map((appointment) => normalizeAppointmentForAnalysis(appointment)).filter(Boolean),
    [appointments]
  );

  const getAppointmentDateTs = React.useCallback((payment) => {
    const appointment = normalizedAppointments.find((item) => item && compareIds(item.id || item._id, payment?.appointment_id));
    if (appointment?.date) return toTimestamp(appointment.date);
    return toTimestamp(payment?.payment_date || payment?.due_date || payment?.created_at || payment?.date);
  }, [normalizedAppointments]);

  const unbilledAppointments = React.useMemo(
    () => normalizedAppointments
      .filter((appointment) =>
        appointment?.status === 'finalizado' &&
        !(payments || []).some(
          (payment) => payment && compareIds(payment.appointment_id, appointment.id || appointment._id)
        )
      )
      .sort((a, b) => toTimestamp(b?.date) - toTimestamp(a?.date)),
    [normalizedAppointments, payments]
  );

  const billedPayments = React.useMemo(
    () => (payments || [])
      .filter((payment) => payment?.appointment_id)
      .sort((a, b) => getAppointmentDateTs(b) - getAppointmentDateTs(a)),
    [payments, getAppointmentDateTs]
  );

  const sortedInvoices = React.useMemo(
    () => [...(invoices || [])].sort(
      (a, b) =>
        toTimestamp(b?.date || b?.issued_at || b?.created_at) -
        toTimestamp(a?.date || a?.issued_at || a?.created_at)
    ),
    [invoices]
  );

  const totals = React.useMemo(
    () => billedPayments.reduce((acc, payment) => {
      const totalAmount = toNumber(payment?.amount);
      const rawPaid = toNumber(payment?.amount_paid);
      const amountPaid = payment?.status === 'pago' && rawPaid <= 0
        ? totalAmount
        : Math.max(0, Math.min(rawPaid, totalAmount || rawPaid));
      return {
        totalBilled: acc.totalBilled + totalAmount,
        totalPaid: acc.totalPaid + amountPaid,
        totalPending: acc.totalPending + Math.max(0, totalAmount - amountPaid)
      };
    }, { totalBilled: 0, totalPaid: 0, totalPending: 0 }),
    [billedPayments]
  );

  // Criar faturamento (Payment)
  const createBillingMutation = useMutation({
    mutationFn: async () => {
      const base = lastBillingRef.current || {};
      const payload = { ...base, created_by: user?.email };
      const res = await enqueueMutation('/api/payments', { method: 'POST', body: payload });
      return res;
    },
    onSuccess: (res) => {
      toast.success(res?.queued ? 'Faturamento enfileirado para sincronização' : 'Faturamento criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowBillingDialog(false);
    }
  });

  // Emitir NF para um faturamento existente
  const createNFMutation = useMutation({
    mutationFn: async (paymentId) => {
      const res = await enqueueMutation('/api/invoices', { method: 'POST', body: { payment_id: paymentId, created_by: user?.email } });
      return res;
    },
    onSuccess: (res) => {
      toast.success(res?.queued ? 'NF enfileirada para emissão' : 'NF emitida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowNFDialog(false);
    }
  });

  const getClientName = (clientId) => {
    const client = clients.find(c => compareIds(c.id || c._id, clientId));
    return client?.name || '-';
  };

  const getAppointment = (appointmentId) => {
    return normalizedAppointments.find(a => compareIds(a.id || a._id, appointmentId));
  };

  const hasInvoice = (paymentId) => {
    const payment = payments.find(p => compareIds(p.id || p._id, paymentId));
    if (!payment) return false;
    
    return invoices.some(inv => {
      const appIds = inv.appointment_ids || [];
      return appIds.some(id => compareIds(id, payment.appointment_id));
    });
  };

  const getPaymentStatusConfig = (payment) => {
    if (payment.status === 'pago') {
      return { label: 'Pago', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CheckCircle };
    }
    if (payment.due_date && new Date(payment.due_date) < new Date().setHours(0, 0, 0, 0)) {
      return { label: 'Atrasado', color: 'bg-red-500/10 text-red-600 border-red-200', icon: AlertCircle };
    }
    return { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Clock };
  };

  const getInvoiceStatusBadge = (status) => {
    const config = {
      'pendente': { label: 'Pendente', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
      'emitida': { label: 'Emitida', color: 'bg-green-500/10 text-green-600 border-green-200' },
      'cancelada': { label: 'Cancelada', color: 'bg-red-500/10 text-red-600 border-red-200' }
    };
    return config[status] || config.pendente;
  };

  const handleBillAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowBillingDialog(true);
  };

  const handleEmitNF = (payment) => {
    setSelectedPayment(payment);
    setShowNFDialog(true);
  };

  const handleDownloadPDF = (invoice) => {
    toast.info('Baixando PDF da NF ' + (invoice.number || invoice.id));
    // MOCK download
    const link = document.createElement('a');
    link.href = '#';
    link.download = `NF_${invoice.number || invoice.id}.pdf`;
    link.click();
  };

  const handleDownloadXML = (invoice) => {
    toast.info('Baixando XML da NF ' + (invoice.number || invoice.id));
    // MOCK download
    const link = document.createElement('a');
    link.href = '#';
    link.download = `NF_${invoice.number || invoice.id}.xml`;
    link.click();
  };

  const handleMonthlyExport = async () => {
    if (invoices.length === 0) {
      toast.error('Não há notas fiscais para exportar.');
      return;
    }

    const loadingToast = toast.loading('Gerando exportação mensal...');
    
    try {
      const zip = new JSZip();
      const nfeFolder = zip.folder("notas_fiscais");
      
      // 1. Adicionar XMLs e PDFs (Mock)
      invoices.forEach(invoice => {
        const fileName = `NF_${invoice.number || invoice.id?.slice(-8).toUpperCase()}`;
        // MOCK: Adicionando conteúdo placeholder para XML e PDF
        nfeFolder.file(`${fileName}.xml`, `<?xml version="1.0" encoding="UTF-8"?><nfe><id>${invoice.id}</id><numero>${invoice.number}</numero></nfe>`);
        nfeFolder.file(`${fileName}.pdf`, "PDF Content Placeholder");
      });

      // 2. Gerar Relatório Excel
      const reportData = invoices.map(invoice => ({
        'Data': format(new Date(invoice.date), 'dd/MM/yyyy'),
        'Número': invoice.number || invoice.id?.slice(-8).toUpperCase(),
        'Cliente': getClientName(invoice.client_id),
        'Valor': invoice.total_amount,
        'Status': invoice.status
      }));

      const ws = utils.json_to_sheet(reportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Resumo Mensal");
      
      // Gerar o buffer do Excel
      const excelBuffer = writeFile(wb, "resumo_mensal.xlsx", { bookType: 'xlsx', type: 'array' });
      zip.file("resumo_mensal.xlsx", excelBuffer);

      // 3. Gerar o ZIP
      const content = await zip.generateAsync({ type: "blob" });
      
      // Download do ZIP
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `exportacao_mensal_${format(new Date(), 'MMMM_yyyy', { locale: ptBR })}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);
      toast.success('Exportação (ZIP) gerada com sucesso!');
    } catch (error) {
      console.error('Erro na exportação:', error);
      toast.dismiss(loadingToast);
      toast.error('Erro ao gerar exportação mensal.');
    }
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const appointmentId = urlParams.get('appointmentId');

    if (action === 'bill' && appointmentId && normalizedAppointments.length > 0) {
      const appointment = normalizedAppointments.find(a => compareIds(a.id || a._id, appointmentId));
      if (appointment) {
        handleBillAppointment(appointment);
        // Limpa os parâmetros da URL para evitar re-abrir ao recarregar
        window.history.replaceState({}, '', createPageUrl('Invoices'));
      }
    }
  }, [normalizedAppointments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Faturamento & Nota Fiscal
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            Controle financeiro e emissão fiscal
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleMonthlyExport}
            className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportação Mensal
          </Button>
        </div>
      </div>

      {/* Alert - Atendimentos não faturados */}
      {unbilledAppointments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-amber-500/10 border border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">
                    {unbilledAppointments.length} atendimento(s) pendente(s) de faturamento
                  </p>
                  <p className="text-sm text-amber-700">
                    Fature os atendimentos para controlar recebimentos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-[var(--bg-card)] h-11 rounded-xl">
          <TabsTrigger value="unbilled" className="rounded-lg data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white">
            A Faturar ({unbilledAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="billed" className="rounded-lg data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white">
            Faturados ({billedPayments.length})
          </TabsTrigger>
          <TabsTrigger value="nf" className="rounded-lg data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white">
            Notas Fiscais ({sortedInvoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Atendimentos para Faturar */}
        <TabsContent value="unbilled" className="mt-4 space-y-3">
          {unbilledAppointments.length === 0 ? (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-[var(--text-primary)] font-semibold">Tudo em dia!</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">Todos os atendimentos foram faturados</p>
              </CardContent>
            </Card>
          ) : (
            unbilledAppointments.map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mt-0.5">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {getClientName(appointment.client_id)}
                            </p>
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 border text-xs">
                              Não Faturado
                            </Badge>
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mb-2">
                            {format(new Date(appointment.date), "d 'de' MMM 'de' yyyy", { locale: ptBR })} • {appointment.type}
                          </p>
                          <p className="text-lg font-bold text-[var(--accent)]">
                            R$ {toNumber(appointment.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white h-9 px-4 rounded-lg"
                          onClick={() => handleBillAppointment(appointment)}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Faturar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        {/* Tab: Faturamentos Realizados */}
        <TabsContent value="billed" className="mt-4 space-y-4">
          {/* Summary Cards for Receivables Control */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-500/5 border-blue-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Total Faturado</p>
                  <p className="text-xl font-bold text-blue-900">
                    R$ {totals.totalBilled.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-500/5 border-green-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Total Recebido</p>
                  <p className="text-xl font-bold text-green-900">
                    R$ {totals.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">A Receber</p>
                  <p className="text-xl font-bold text-amber-900">
                    R$ {totals.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {billedPayments.length === 0 ? (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <p className="text-[var(--text-primary)] font-semibold">Nenhum faturamento</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">Fature atendimentos para aparecerem aqui</p>
              </CardContent>
            </Card>
          ) : (
            billedPayments.map((payment, index) => {
              const appointment = getAppointment(payment.appointment_id);
              const statusConfig = getPaymentStatusConfig(payment);
              const StatusIcon = statusConfig.icon;
              const hasNF = hasInvoice(payment.id || payment._id);

              return (
                <motion.div
                  key={payment.id || payment._id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center mt-0.5">
                            <DollarSign className="w-5 h-5 text-[var(--accent)]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-[var(--text-primary)]">
                                {getClientName(payment.client_id)}
                              </p>
                              <Badge className={`${statusConfig.color} border text-xs`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                              {hasNF && (
                                <Badge className="bg-green-500/10 text-green-600 border-green-200 border text-xs">
                                  <FileCheck className="w-3 h-3 mr-1" />
                                  NF Emitida
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-2">
                              {payment.due_date && format(new Date(payment.due_date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                              {payment.payment_method && ` • ${payment.payment_method}`}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-[var(--text-muted)]">Total: </span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  R$ {toNumber(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            {appointment && (
                              <DropdownMenuItem asChild>
                                <Link to={createPageUrl('AppointmentDetail') + `?id=${appointment.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver Atendimento
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {!hasNF && (
                              <DropdownMenuItem onClick={() => handleEmitNF(payment)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Emitir Nota Fiscal
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* Tab: Notas Fiscais */}
        <TabsContent value="nf" className="mt-4 space-y-3">
          {invoices.length === 0 ? (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <p className="text-[var(--text-primary)] font-semibold">Nenhuma Nota Fiscal</p>
                <p className="text-[var(--text-muted)] text-sm mt-1 mb-4">Emita NFs a partir de faturamentos realizados</p>
                <Button variant="outline" className="border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white" onClick={() => window.location.href = '/settings'}>
                  Configurar Emissão de NF
                </Button>
              </CardContent>
            </Card>
          ) : (
            sortedInvoices.map((invoice, index) => {
              const statusBadge = getInvoiceStatusBadge(invoice.status);
              
              return (
                <motion.div
                  key={invoice.id || invoice._id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center mt-0.5">
                            <FileText className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-[var(--text-primary)]">
                                {getClientName(invoice.client_id)}
                              </p>
                              <Badge className={`${statusBadge.color} border text-xs`}>
                                {statusBadge.label}
                              </Badge>
                              {invoice.number && (
                                <span className="text-sm text-[var(--text-muted)]">Nº {invoice.number}</span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-2">
                              {format(new Date(invoice.date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-lg font-bold text-[var(--accent)]">
                              R$ {toNumber(invoice.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)} className="cursor-pointer">
                              <Download className="w-4 h-4 mr-2" />
                              Baixar PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadXML(invoice)} className="cursor-pointer">
                              <Download className="w-4 h-4 mr-2" />
                              Baixar XML
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Send className="w-4 h-4 mr-2" />
                              Reenviar NF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600 cursor-pointer">
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancelar NF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Faturar Atendimento */}
      <Dialog open={showBillingDialog} onOpenChange={setShowBillingDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Faturar Atendimento</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const getStr = (v) => typeof v === 'string' ? v : '';
              const status = getStr(fd.get('status'));
              lastBillingRef.current = {
                appointment_id: selectedAppointment.id || selectedAppointment._id,
                client_id: selectedAppointment.client_id,
                amount: toNumber(getStr(fd.get('amount'))),
                status,
                payment_method: getStr(fd.get('payment_method')),
                payment_date: status === 'pago' ? new Date().toISOString().split('T')[0] : null,
                due_date: getStr(fd.get('due_date')),
                notes: getStr(fd.get('notes'))
              };
              createBillingMutation.mutate();
            }}>
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {getClientName(selectedAppointment.client_id)}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {format(new Date(selectedAppointment.date), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div>
                  <Label className="text-[var(--text-primary)]">Valor Final</Label>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={selectedAppointment.total_amount}
                    className="mt-1.5 h-11 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
                    required
                  />
                </div>

                <div>
                  <Label className="text-[var(--text-primary)]">Forma de Pagamento</Label>
                  <select 
                    name="payment_method" 
                    required
                    className="w-full mt-1.5 h-11 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Selecione</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[var(--text-primary)]">Status do Pagamento</Label>
                  <select 
                    name="status" 
                    defaultValue="pendente" 
                    required
                    className="w-full mt-1.5 h-11 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
                  >
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[var(--text-primary)]">Data de Vencimento</Label>
                  <Input
                    name="due_date"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="mt-1.5 h-11 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
                    required
                  />
                </div>

                <div>
                  <Label className="text-[var(--text-primary)]">Observações</Label>
                  <Textarea
                    name="notes"
                    placeholder="Notas adicionais..."
                    className="mt-1.5 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="flex-1 h-11 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setShowBillingDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1 h-11 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                    disabled={createBillingMutation.isPending}
                  >
                    {createBillingMutation.isPending ? 'Faturando...' : 'Confirmar Faturamento'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Emitir Nota Fiscal */}
      <Dialog open={showNFDialog} onOpenChange={setShowNFDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Emitir Nota Fiscal</DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <p className="font-semibold text-[var(--text-primary)]">
                  {getClientName(selectedPayment.client_id)}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Valor: R$ {toNumber(selectedPayment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-200">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">Emissão Fiscal</p>
                    <p>Esta ação irá emitir uma Nota Fiscal eletrônica através da API fiscal integrada.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                  onClick={() => setShowNFDialog(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 h-11 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                  onClick={() => createNFMutation.mutate(selectedPayment.id || selectedPayment._id)}
                  disabled={createNFMutation.isPending}
                >
                  {createNFMutation.isPending ? 'Emitindo...' : 'Emitir Nota Fiscal'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
