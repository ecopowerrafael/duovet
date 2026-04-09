import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
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
  FileText,
  Download,
  Send,
  Eye,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  MapPin,
  User,
  Stethoscope,
  Briefcase,
  Activity,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import { offlineFetch } from '../lib/offline';
import { utils, writeFile } from 'xlsx';
import { compareIds } from '../lib/utils';
import {
  getAppointmentClientId,
  getAppointmentPropertyId,
  normalizeAppointmentForAnalysis
} from '../lib/appointments';

const REPORT_TYPES_CONFIG = {
  clinico: { label: 'Atendimento', color: 'bg-blue-500/10 text-blue-600', icon: Stethoscope },
  reprodutivo: { label: 'Reprodutivo', color: 'bg-pink-500/10 text-pink-600', icon: Activity },
  consultoria: { label: 'Consultoria', color: 'bg-purple-500/10 text-purple-600', icon: Briefcase },
  cirurgico: { label: 'Cirúrgico', color: 'bg-red-500/10 text-red-600', icon: Activity },
  sanitario: { label: 'Sanitário', color: 'bg-green-500/10 text-green-600', icon: Stethoscope },
  preventivo: { label: 'Preventivo', color: 'bg-yellow-500/10 text-yellow-600', icon: Stethoscope },
};

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReportType, setFilterReportType] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

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
            className={`h-11 w-full justify-start rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)] font-normal ${className}`}
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

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/appointments?sort=-date' : `/api/appointments?created_by=${user?.email}&sort=-date`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${user?.email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${user?.email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const getClientName = (clientId) => clients.find(c => compareIds(c.id || c._id, clientId))?.name || '-';
  const getPropertyName = (propertyId) => properties.find(p => compareIds(p.id || p._id, propertyId))?.name || '-';
  const normalizedAppointments = (appointments || []).map(normalizeAppointmentForAnalysis).filter(Boolean);
  
  // Gerar relatórios a partir dos atendimentos finalizados
  const generatedReports = normalizedAppointments
    .filter(appt => appt.status === 'finalizado' || appt.status === 'faturado')
    .map(appt => ({
      id: `report_${appt.id || appt._id}`,
      appointment_id: appt.id || appt._id,
      client_id: getAppointmentClientId(appt),
      property_id: getAppointmentPropertyId(appt),
      type: appt.type,
      date: appt.date,
      observations: appt.observations
    }));

  const filteredReports = generatedReports.filter(r => {
    const matchesSearch = getClientName(r.client_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getPropertyName(r.property_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesReportType = filterReportType === 'all' || r.type === filterReportType;
    const matchesClient = filterClient === 'all' || compareIds(r.client_id, filterClient);
    const matchesProperty = filterProperty === 'all' || compareIds(r.property_id, filterProperty);
    const matchesTab = activeTab === 'all' || r.type === activeTab;
    
    const reportDate = new Date(r.date);
    const matchesDateFrom = !filterDateFrom || reportDate >= new Date(filterDateFrom);
    const matchesDateTo = !filterDateTo || reportDate <= new Date(filterDateTo + 'T23:59:59');

    return matchesSearch && matchesReportType && matchesClient && matchesProperty && 
           matchesTab && matchesDateFrom && matchesDateTo;
  });

  const activeFiltersCount = [filterReportType, filterClient, filterProperty, filterDateFrom, filterDateTo]
    .filter(f => f && f !== 'all').length;

  const isValidDate = (date) => {
    if (!date) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  };

  const formatDate = (date) => isValidDate(date) ? format(new Date(date), 'dd/MM/yyyy') : '-';

  const handleDownloadPDF = async (report) => {
    const appointmentId = report?.appointment_id || report;
    const appointment = appointments.find(a => compareIds(a.id || a._id, appointmentId));
    if (!appointment) {
      toast.error('Atendimento não encontrado');
      return;
    }
    window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=generatePDF`;
  };

  const handleSendWhatsApp = async (report) => {
    const appointmentId = report?.appointment_id;
    if (!appointmentId) {
      toast.error('Relatório sem atendimento vinculado');
      return;
    }
    window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=sendWhatsApp`;
  };

  const handleViewReport = (report) => {
    if (!report?.appointment_id) {
      toast.error('Relatório sem atendimento vinculado');
      return;
    }
    window.location.href = createPageUrl('AppointmentDetail') + `?id=${report.appointment_id}`;
  };

  const handleGenerateReport = async () => {
    if (filteredReports.length === 0) {
      toast.error('Nenhum relatório disponível para gerar');
      return;
    }
    const latestReport = [...filteredReports].sort((a, b) => {
      const dateA = new Date(a?.date || 0).getTime();
      const dateB = new Date(b?.date || 0).getTime();
      return dateB - dateA;
    })[0];
    await handleDownloadPDF(latestReport);
  };

  const handleExport = (formatType = 'xlsx') => {
    if (filteredReports.length === 0) {
      toast.error('Nenhum relatório para exportar');
      return;
    }

    const fileName = `relatorios_exportacao_${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === 'csv') {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Data,Cliente,Propriedade,Tipo,Observacoes\n";
      
      filteredReports.forEach(r => {
        const row = [
          format(new Date(r.date), 'dd/MM/yyyy'),
          getClientName(r.client_id),
          getPropertyName(r.property_id),
          REPORT_TYPES_CONFIG[r.type]?.label || r.type,
          (r.observations || "").replace(/,/g, ";")
        ].join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exportação CSV gerada com sucesso!');
    } else {
      const exportData = filteredReports.map(r => ({
        'Data': format(new Date(r.date), 'dd/MM/yyyy'),
        'Cliente': getClientName(r.client_id),
        'Propriedade': getPropertyName(r.property_id),
        'Tipo': REPORT_TYPES_CONFIG[r.type]?.label || r.type,
        'Observações': r.observations || ""
      }));

      const worksheet = utils.json_to_sheet(exportData);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, 'Relatórios');
      
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

  // Contar relatórios por tipo
  const reportCounts = {
    all: generatedReports.length,
    clinico: generatedReports.filter(r => r.type === 'clinico').length,
    reprodutivo: generatedReports.filter(r => r.type === 'reprodutivo').length,
    consultoria: generatedReports.filter(r => r.type === 'consultoria').length,
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header - iOS Mobile Friendly */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-3xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">Relatórios</h1>
          <p className="text-[var(--text-muted)] mt-0.5 text-sm font-medium">Relatórios de atendimentos, consultorias e acompanhamentos</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold shadow-sm">
                <Download className="w-5 h-5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl w-48">
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleGenerateReport}
            className="w-full md:w-auto bg-[#22c55e] hover:bg-[#16a34a] text-white gap-2 h-12 px-6 rounded-2xl font-semibold shadow-lg shadow-[#22c55e]/25"
          >
            <Plus className="w-5 h-5" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      {/* Tabs - Type Filter - iOS Mobile Friendly */}
      <div className="w-full max-w-full overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-2 w-full">
          <div className="w-full grid grid-cols-4 gap-1.5 bg-transparent p-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-xl text-[10px] md:text-sm px-1.5 md:px-4 py-2 whitespace-normal leading-tight transition-all font-medium ${
                activeTab === 'all' 
                  ? 'bg-[#22c55e] text-white shadow-md' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Todos<br className="md:hidden"/><span className="block md:inline"> ({reportCounts.all})</span>
            </button>
            <button
              onClick={() => setActiveTab('clinico')}
              className={`rounded-xl text-[10px] md:text-sm px-1.5 md:px-4 py-2 whitespace-normal leading-tight transition-all font-medium ${
                activeTab === 'clinico' 
                  ? 'bg-[#22c55e] text-white shadow-md' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Atend.<br className="md:hidden"/><span className="block md:inline"> ({reportCounts.clinico})</span>
            </button>
            <button
              onClick={() => setActiveTab('consultoria')}
              className={`rounded-xl text-[10px] md:text-sm px-1.5 md:px-4 py-2 whitespace-normal leading-tight transition-all font-medium ${
                activeTab === 'consultoria' 
                  ? 'bg-[#22c55e] text-white shadow-md' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Consult.<br className="md:hidden"/><span className="block md:inline"> ({reportCounts.consultoria})</span>
            </button>
            <button
              onClick={() => setActiveTab('reprodutivo')}
              className={`rounded-xl text-[10px] md:text-sm px-1.5 md:px-4 py-2 whitespace-normal leading-tight transition-all font-medium ${
                activeTab === 'reprodutivo' 
                  ? 'bg-[#22c55e] text-white shadow-md' 
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Reprod.<br className="md:hidden"/><span className="block md:inline"> ({reportCounts.reprodutivo})</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Filters - Desktop */}
      <Card className="hidden md:block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label className="text-sm mb-2">Buscar</Label>
              <Input
                placeholder="Cliente, propriedade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl bg-[var(--bg-tertiary)] border-[var(--border-color)]"
              />
            </div>
            <div>
              <Label className="text-sm mb-2">Cliente</Label>
              <select
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              >
                <option value="all">Todos</option>
                {clients.map(c => (
                  <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">Propriedade</Label>
              <select
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filterProperty}
                onChange={(e) => setFilterProperty(e.target.value)}
              >
                <option value="all">Todas</option>
                {properties.map(p => (
                  <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm mb-2">De</Label>
              <DatePickerField value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Data inicial" />
            </div>
            <div>
              <Label className="text-sm mb-2">Até</Label>
              <DatePickerField value={filterDateTo} onChange={setFilterDateTo} placeholder="Data final" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Search & Filter */}
      <div className="md:hidden space-y-3 w-full max-w-full box-border">
        <div className="relative w-full box-border">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
          <Input
            placeholder="Buscar cliente, propriedade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-2xl bg-[var(--bg-card)] border-[var(--border-color)] w-full box-border"
          />
        </div>
        <Button
          onClick={() => setIsFilterDrawerOpen(true)}
          variant="outline"
          className="w-full h-12 rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] gap-2 font-semibold box-border"
        >
          <Filter className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 text-left">Filtrar</span>
          {activeFiltersCount > 0 && (
            <Badge className="bg-[#22c55e] text-white h-5 px-2 rounded-full flex-shrink-0">{activeFiltersCount}</Badge>
          )}
        </Button>
      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-5 w-full max-w-full box-border">
          <div className="w-full">
            <Label className="text-sm mb-2 font-semibold block">Cliente</Label>
            <select
              className="h-12 w-full rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="all">Todos</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <Label className="text-sm mb-2 font-semibold block">Propriedade</Label>
            <select
              className="h-12 w-full rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
            >
              <option value="all">Todas</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <Label className="text-sm mb-2 font-semibold block">Data inicial</Label>
            <DatePickerField value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Data inicial" className="h-12 rounded-2xl" />
          </div>
          <div className="w-full">
            <Label className="text-sm mb-2 font-semibold block">Data final</Label>
            <DatePickerField value={filterDateTo} onChange={setFilterDateTo} placeholder="Data final" className="h-12 rounded-2xl" />
          </div>
        </div>
      </MobileFilterDrawer>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-primary)] font-semibold text-lg">Nenhum relatório disponível</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Os relatórios serão gerados a partir dos atendimentos finalizados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report, index) => {
            const typeConfig = REPORT_TYPES_CONFIG[report.type] || REPORT_TYPES_CONFIG.clinico;
            const Icon = typeConfig.icon;

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/40 transition-all group">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                      {/* Icon + Main Info - iOS Mobile Friendly */}
                      <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0 w-full overflow-hidden">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#22c55e]/25">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors break-words">
                              {getClientName(report.client_id)}
                            </h3>
                            <Badge className={`${typeConfig.color} border-0 text-xs font-semibold px-2.5 py-0.5 rounded-lg flex-shrink-0`}>
                              {typeConfig.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:text-sm text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="break-words">{getPropertyName(report.property_id)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="whitespace-nowrap">{format(new Date(report.date), 'dd/MM/yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="break-words">{user?.full_name || 'Veterinário'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions - iOS Mobile Friendly */}
                      <div className="flex items-center gap-2 md:ml-auto justify-end md:justify-start flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(report)}
                          className="h-11 w-11 md:h-9 md:w-auto md:px-3 rounded-2xl md:rounded-lg text-[#22c55e] hover:bg-[#22c55e]/10"
                          title="Visualizar"
                        >
                          <Eye className="w-5 h-5 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(report)}
                          className="h-11 w-11 md:h-9 md:w-auto md:px-3 rounded-2xl md:rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                          title="Baixar PDF"
                        >
                          <Download className="w-5 h-5 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendWhatsApp(report)}
                          className="h-11 w-11 md:h-9 md:w-auto md:px-3 rounded-2xl md:rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                          title="Enviar WhatsApp"
                        >
                          <Send className="w-5 h-5 md:w-4 md:h-4" />
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
    </div>
  );
}
