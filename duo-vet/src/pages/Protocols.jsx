import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContextJWT';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  Stethoscope,
  Heart,
  Shield,
  Syringe,
  Scissors,
  Copy,
  RotateCw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const TYPES = [
  { value: 'clinico', label: 'Clínico', icon: Stethoscope, color: 'bg-blue-500' },
  { value: 'reprodutivo', label: 'Reprodutivo', icon: Heart, color: 'bg-pink-500' },
  { value: 'cirurgico', label: 'Cirúrgico', icon: Scissors, color: 'bg-red-500' },
  { value: 'sanitario', label: 'Sanitário', icon: Shield, color: 'bg-green-500' },
  { value: 'preventivo', label: 'Preventivo', icon: Syringe, color: 'bg-purple-500' }
];

export default function Protocols() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    subtype: '',
    description: '',
    default_procedures: [],
    default_medications: [],
    follow_up_days: '',
    observations_template: '',
    is_active: true
  });
  const [newProcedure, setNewProcedure] = useState({ name: '', value: '' });
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', quantity: '', value: '' });

  const queryClient = useQueryClient();

  const { user } = useAuth();

  const { data: protocols = [], isLoading, refetch: refetchProtocols, isRefetching } = useQuery({
    queryKey: ['protocols', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      return await offlineFetch(`/api/protocols?created_by=${isAdmin ? '' : email}&sort=-created_date`);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      refetchProtocols(),
      {
        loading: 'Atualizando protocolos...',
        success: 'Protocolos atualizados!',
        error: 'Erro ao atualizar protocolos'
      }
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return await enqueueMutation('/api/protocols', {
        method: 'POST',
        body: {
          ...formData,
          created_by: user?.email,
          follow_up_days: formData.follow_up_days ? parseInt(formData.follow_up_days) : null
        }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['protocols', user?.email] });
      toast.success(res?.queued ? 'Protocolo enfileirado para sincronização' : 'Protocolo criado com sucesso!');
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingProtocol) return null;
      return await enqueueMutation(`/api/protocols/${editingProtocol.id}`, {
        method: 'PUT',
        body: {
          ...formData,
          created_by: user?.email,
          follow_up_days: formData.follow_up_days ? parseInt(formData.follow_up_days) : null
        }
      });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['protocols', user?.email] });
      toast.success(res?.queued ? 'Protocolo enfileirado para sincronização' : 'Protocolo atualizado com sucesso!');
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await enqueueMutation(`/api/protocols/${id}`, { method: 'DELETE' });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['protocols', user?.email] });
      toast.success(res?.queued ? 'Exclusão enfileirada para sincronização' : 'Protocolo removido com sucesso!');
    }
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingProtocol(null);
    setFormData({
      name: '',
      type: '',
      subtype: '',
      description: '',
      default_procedures: [],
      default_medications: [],
      follow_up_days: '',
      observations_template: '',
      is_active: true
    });
    setNewProcedure({ name: '', value: '' });
    setNewMedication({ name: '', dosage: '', quantity: '', value: '' });
  };

  const handleEdit = (protocol) => {
    setEditingProtocol(protocol);
    setFormData({
      name: protocol.name || '',
      type: protocol.type || '',
      subtype: protocol.subtype || '',
      description: protocol.description || '',
      default_procedures: protocol.default_procedures || [],
      default_medications: protocol.default_medications || [],
      follow_up_days: protocol.follow_up_days?.toString() || '',
      observations_template: protocol.observations_template || '',
      is_active: protocol.is_active !== false
    });
    setIsOpen(true);
  };

  const handleDuplicate = (protocol) => {
    setFormData({
      name: `${protocol.name} (Cópia)`,
      type: protocol.type || '',
      subtype: protocol.subtype || '',
      description: protocol.description || '',
      default_procedures: protocol.default_procedures || [],
      default_medications: protocol.default_medications || [],
      follow_up_days: protocol.follow_up_days?.toString() || '',
      observations_template: protocol.observations_template || '',
      is_active: true
    });
    setIsOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProtocol) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const addProcedure = () => {
    if (newProcedure.name && newProcedure.value) {
      setFormData({
        ...formData,
        default_procedures: [...formData.default_procedures, {
          name: newProcedure.name,
          value: parseFloat(newProcedure.value)
        }]
      });
      setNewProcedure({ name: '', value: '' });
    }
  };

  const addMedication = () => {
    if (newMedication.name) {
      setFormData({
        ...formData,
        default_medications: [...formData.default_medications, {
          name: newMedication.name,
          dosage: newMedication.dosage,
          quantity: parseFloat(newMedication.quantity) || 1,
          value: parseFloat(newMedication.value) || 0
        }]
      });
      setNewMedication({ name: '', dosage: '', quantity: '', value: '' });
    }
  };

  const filteredProtocols = protocols.filter(protocol => {
    const matchesSearch = protocol.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || protocol.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Protocolos</h1>
            <p className="text-[var(--text-muted)] mt-1">Configure protocolos de atendimento personalizados</p>
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
              onClick={() => setIsOpen(true)}
              className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-medium rounded-xl gap-2 h-12 px-6"
            >
              <Plus className="w-5 h-5" />
              Novo Protocolo
            </Button>
          </div>
        </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Buscar protocolo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-48 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="all">Todos os tipos</option>
          {TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Protocols Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
        </div>
      ) : filteredProtocols.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
          <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            {searchTerm ? 'Nenhum protocolo encontrado' : 'Nenhum protocolo cadastrado'}
          </p>
          <p className="text-[var(--text-muted)] mt-1">
            {searchTerm ? 'Tente uma busca diferente' : 'Crie protocolos para agilizar seus atendimentos'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProtocols.map((protocol, index) => {
            const typeConfig = TYPES.find(t => t.value === protocol.type) || TYPES[0];
            const Icon = typeConfig.icon;
            
            return (
              <motion.div
                key={protocol.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${typeConfig.color} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-lg">
                        <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => handleEdit(protocol)} className="cursor-pointer">
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(protocol)} className="cursor-pointer">
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMutation.mutate(protocol.id)}
                        className="text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="font-semibold text-[var(--text-primary)] mb-1">{protocol.name}</h3>
                <Badge className={`${typeConfig.color}/20 text-${typeConfig.color.replace('bg-', '')} border-0 mb-3`}>
                  {typeConfig.label}
                </Badge>
                
                {protocol.description && (
                  <p className="text-sm text-[var(--text-muted)] mb-3 line-clamp-2">{protocol.description}</p>
                )}
                
                <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                  {(protocol.default_procedures?.length || 0) > 0 && (
                    <span>{protocol.default_procedures.length} procedimento(s)</span>
                  )}
                  {(protocol.default_medications?.length || 0) > 0 && (
                    <span>• {protocol.default_medications.length} medicamento(s)</span>
                  )}
                  {protocol.follow_up_days && (
                    <span>• Retorno em {protocol.follow_up_days} dias</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4 bg-[var(--bg-tertiary)]">
            <DialogTitle className="text-xl font-bold text-[var(--text-primary)]">
              {editingProtocol ? 'Editar Protocolo' : 'Novo Protocolo'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Protocolo *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: IATF Padrão"
                  required
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione o tipo</option>
                  {TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do protocolo..."
                rows={2}
                className="rounded-xl"
              />
            </div>

            {/* Default Procedures */}
            <div className="space-y-3">
              <Label>Procedimentos Padrão</Label>
              {formData.default_procedures.length > 0 && (
                <div className="space-y-2">
                  {formData.default_procedures.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-[var(--bg-tertiary)] rounded-xl">
                      <span className="text-[var(--text-primary)]">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">R$ {p.value?.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFormData({
                            ...formData,
                            default_procedures: formData.default_procedures.filter((_, idx) => idx !== i)
                          })}
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
                  placeholder="Nome"
                  value={newProcedure.name}
                  onChange={(e) => setNewProcedure({ ...newProcedure, name: e.target.value })}
                  className="flex-1 h-11 rounded-xl"
                />
                <Input
                  type="number"
                  placeholder="R$"
                  value={newProcedure.value}
                  onChange={(e) => setNewProcedure({ ...newProcedure, value: e.target.value })}
                  className="w-24 h-11 rounded-xl"
                />
                <Button type="button" variant="outline" onClick={addProcedure} className="h-11 rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Default Medications */}
            <div className="space-y-3">
              <Label>Medicamentos Padrão</Label>
              {formData.default_medications.length > 0 && (
                <div className="space-y-2">
                  {formData.default_medications.map((m, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-[var(--bg-tertiary)] rounded-xl">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{m.name}</span>
                        {m.dosage && <span className="text-[var(--text-muted)] ml-2">- {m.dosage}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-muted)]">Qtd: {m.quantity}</span>
                        <span className="font-medium text-[var(--text-primary)]">R$ {m.value?.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFormData({
                            ...formData,
                            default_medications: formData.default_medications.filter((_, idx) => idx !== i)
                          })}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2">
                <Input
                  placeholder="Medicamento"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                  className="h-11 rounded-xl"
                />
                <Input
                  placeholder="Dosagem"
                  value={newMedication.dosage}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                  className="h-11 rounded-xl"
                />
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={newMedication.quantity}
                  onChange={(e) => setNewMedication({ ...newMedication, quantity: e.target.value })}
                  className="h-11 rounded-xl"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="R$"
                    value={newMedication.value}
                    onChange={(e) => setNewMedication({ ...newMedication, value: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                  <Button type="button" variant="outline" onClick={addMedication} className="h-11 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Follow-up & Template */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dias para Retorno</Label>
                <Input
                  type="number"
                  value={formData.follow_up_days}
                  onChange={(e) => setFormData({ ...formData, follow_up_days: e.target.value })}
                  placeholder="Ex: 7"
                  className="h-12 rounded-xl"
                />
                <p className="text-xs text-[var(--text-muted)]">Agenda retorno automaticamente</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de Observações</Label>
              <Textarea
                value={formData.observations_template}
                onChange={(e) => setFormData({ ...formData, observations_template: e.target.value })}
                placeholder="Texto padrão para observações..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingProtocol ? 'Salvar' : 'Criar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
