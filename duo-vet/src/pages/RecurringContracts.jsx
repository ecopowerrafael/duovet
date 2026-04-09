import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, TrendingUp, Calendar, DollarSign, Pause, Play, Edit2, RotateCw } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { toast } from 'sonner';
import { compareIds, formatCurrency, parseCurrency } from '../lib/utils';

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

export default function RecurringContracts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [statusChange, setStatusChange] = useState({ id: null, newStatus: null });
  const [formData, setFormData] = useState({
    client_id: '',
    property_id: '',
    contract_type: 'acompanhamento_tecnico',
    billing_frequency: 'mensal',
    amount: '',
    payment_method: '',
    start_date: new Date().toISOString().split('T')[0],
    status: 'ativo',
    issue_invoice: false,
    description: ''
  });

  const { data: contracts = [], isLoading, refetch: refetchContracts, isRefetching } = useQuery({
    queryKey: ['contracts', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/contracts' : `/api/contracts?created_by=${user?.email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${user?.email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: properties = [], refetch: refetchProperties } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const isAdmin = user?.email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${user?.email}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchContracts(),
        refetchClients(),
        refetchProperties()
      ]),
      {
        loading: 'Atualizando contratos...',
        success: 'Contratos atualizados!',
        error: 'Erro ao atualizar contratos'
      }
    );
  };

  const createContract = useMutation({
    mutationFn: async () => {
      const nextBillingDate =
        formData.billing_frequency === 'mensal'
          ? addMonths(new Date(formData.start_date), 1).toISOString().split('T')[0]
          : formData.billing_frequency === 'trimestral'
          ? addMonths(new Date(formData.start_date), 3).toISOString().split('T')[0]
          : formData.billing_frequency === 'semestral'
          ? addMonths(new Date(formData.start_date), 6).toISOString().split('T')[0]
          : addMonths(new Date(formData.start_date), 12).toISOString().split('T')[0];
      
      const payload = {
        ...formData,
        amount: parseCurrency(formData.amount),
        next_billing_date: nextBillingDate,
        created_by: user?.email
      };

      return enqueueMutation('/api/contracts', {
        method: 'POST',
        body: payload
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts', user?.email] });
      toast.success(res?.queued ? 'Contrato enfileirado para sincronização' : 'Contrato criado com sucesso!');
      setShowDialog(false);
      resetForm();
    }
  });

  const updateContract = useMutation({
    mutationFn: async () => {
      if (!editingContract) return null;
      const payload = {
        id: editingContract.id || editingContract._id,
        ...formData,
        amount: parseCurrency(formData.amount),
        created_by: user?.email
      };
      
      return enqueueMutation(`/api/contracts/${editingContract.id || editingContract._id}`, {
        method: 'PUT',
        body: payload
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts', user?.email] });
      toast.success(res?.queued ? 'Contrato enfileirado para sincronização' : 'Contrato atualizado com sucesso!');
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteContract = useMutation({
    mutationFn: (id) => enqueueMutation(`/api/contracts/${id}`, { method: 'DELETE' }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts', user?.email] });
      toast.success(res?.queued ? 'Exclusão enfileirada para sincronização' : 'Contrato removido com sucesso!');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      const id = statusChange.id;
      if (!id) return null;
      return enqueueMutation(`/api/contracts/${id}/status`, {
        method: 'PATCH',
        body: { status: statusChange.newStatus, created_by: user?.email }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts', user?.email] });
      toast.success(res?.queued ? 'Status enfileirado para sincronização' : 'Status atualizado!');
      setStatusChange({ id: null, newStatus: null });
    }
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      property_id: '',
      contract_type: 'acompanhamento_tecnico',
      billing_frequency: 'mensal',
      amount: '',
      payment_method: '',
      start_date: new Date().toISOString().split('T')[0],
      status: 'ativo',
      issue_invoice: false,
      description: ''
    });
    setEditingContract(null);
  };

  const handleEdit = (contract) => {
    setEditingContract(contract);
    setFormData({
      client_id: contract.client_id || '',
      property_id: contract.property_id || '',
      contract_type: contract.contract_type || 'acompanhamento_tecnico',
      billing_frequency: contract.billing_frequency || 'mensal',
      amount: formatCurrency(contract.amount || 0),
      payment_method: contract.payment_method || '',
      start_date: contract.start_date || new Date().toISOString().split('T')[0],
      status: contract.status || 'ativo',
      issue_invoice: contract.issue_invoice || false,
      description: contract.description || ''
    });
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingContract) {
      updateContract.mutate();
    } else {
      createContract.mutate();
    }
  };

  const toggleStatus = (contract) => {
    const newStatus = contract.status === 'ativo' ? 'suspenso' : 'ativo';
    setStatusChange({ id: contract.id || contract._id, newStatus });
    updateStatusMutation.mutate();
  };

  const getClientName = (clientId) => clients.find(c => compareIds(c.id || c._id, clientId))?.name || '-';
  const getPropertyName = (propertyId) => properties.find(p => compareIds(p.id || p._id, propertyId))?.name || '-';
  const clientProperties = properties.filter(p => compareIds(p.client_id, formData.client_id));

  const activeContracts = contracts.filter(c => c.status === 'ativo');
  const monthlyRevenue = activeContracts
    .filter(c => c.billing_frequency === 'mensal')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Contratos Recorrentes</h1>
          <p className="text-[var(--text-muted)] mt-1">Acompanhamentos técnicos e consultorias recorrentes</p>
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
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-xl font-medium"
          >
            <Plus className="w-5 h-5" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="p-5">
            <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{activeContracts.length}</p>
            <p className="text-sm opacity-90">Contratos Ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-5">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-sm opacity-90">Receita Mensal Recorrente</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="p-5">
            <Calendar className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{contracts.length}</p>
            <p className="text-sm opacity-90">Total de Contratos</p>
          </CardContent>
        </Card>
      </div>

      {/* Contracts List */}
      <div className="space-y-3">
        {contracts.length === 0 ? (
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardContent className="py-16 text-center">
              <TrendingUp className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-primary)] font-semibold">Nenhum contrato cadastrado</p>
              <p className="text-[var(--text-muted)] mt-1">Crie contratos de acompanhamento técnico recorrente</p>
            </CardContent>
          </Card>
        ) : (
          contracts.map((contract) => (
            <Card key={contract.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--accent)]/50 transition-all">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {getClientName(contract.client_id)} - {getPropertyName(contract.property_id)}
                      </h3>
                      <Badge className={
                        contract.status === 'ativo' ? 'bg-green-100 text-green-700' :
                        contract.status === 'suspenso' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }>
                        {contract.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mb-1">
                      {contract.contract_type.replace('_', ' ').toUpperCase()} • Cobrança {contract.billing_frequency}
                    </p>
                    {contract.description && (
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-1">{contract.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                      <span>Início: {format(new Date(contract.start_date), 'dd/MM/yyyy')}</span>
                      {contract.next_billing_date && (
                        <span>Próxima cobrança: {format(new Date(contract.next_billing_date), 'dd/MM/yyyy')}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                      <p className="font-bold text-xl text-[var(--accent)]">
                        R$ {contract.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{contract.billing_frequency}</p>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => toggleStatus(contract)}
                      className="rounded-lg"
                    >
                      {contract.status === 'ativo' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleEdit(contract)}
                      className="rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl rounded-2xl" aria-describedby="contract-dialog-description">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Editar Contrato' : 'Novo Contrato Recorrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" id="contract-dialog-description">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value, property_id: '' })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Propriedade *</Label>
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  disabled={!formData.client_id}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                >
                  <option value="" disabled>Selecione</option>
                  {clientProperties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Tipo de Contrato *</Label>
                <select
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="acompanhamento_tecnico">Acompanhamento Técnico</option>
                  <option value="consultoria_mensal">Consultoria Mensal</option>
                  <option value="assessoria_nutricional">Assessoria Nutricional</option>
                  <option value="assessoria_sanitaria">Assessoria Sanitária</option>
                </select>
              </div>

              <div>
                <Label>Frequência de Cobrança *</Label>
                <select
                  value={formData.billing_frequency}
                  onChange={(e) => setFormData({ ...formData, billing_frequency: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              <div>
                <Label>Valor *</Label>
                <Input
                  type="text"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatDisplayCurrency(e.target.value) })}
                  placeholder="R$ 0,00"
                  className="rounded-xl"
                  inputMode="numeric"
                  required
                />
              </div>

              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Descrição do Serviço</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o escopo do acompanhamento..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createContract.isPending || updateContract.isPending}
                className="rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
              >
                {editingContract ? 'Atualizar' : 'Criar Contrato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
