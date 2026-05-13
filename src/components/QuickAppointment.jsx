import React, { useState } from 'react';
// import { base44 } from '../api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Checkbox } from "./ui/checkbox";
import {
  Zap,
  User,
  Milk,
  Stethoscope,
  Save,
  ChevronRight,
  Plus
} from 'lucide-react';
import AnimalIcon from './animals/AnimalIcon';
import { offlineFetch, enqueueMutation } from '../lib/offline';
import { toast } from 'sonner';
import { compareIds, deepClean } from '../lib/utils';
import { getSettings } from '../lib/api';

const TYPES = [
  { value: 'clinico', label: 'Clínico' },
  { value: 'reprodutivo', label: 'Reprodutivo' },
  { value: 'cirurgico', label: 'Cirúrgico' },
  { value: 'sanitario', label: 'Sanitário' },
  { value: 'preventivo', label: 'Preventivo' }
];

export default function QuickAppointment({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    date: new Date().toISOString().slice(0, 16),
    client_id: '',
    property_id: '',
    animal_ids: [],
    procedures: [],
    medications: [],
    observations: '',
    status: 'em_andamento'
  });
  
  const [newProcedure, setNewProcedure] = useState({ name: '', value: '' });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      const res = await offlineFetch(`/api/clients${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      const res = await offlineFetch(`/api/properties${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: animals = [] } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const query = isAdmin ? '' : `?created_by=${email}`;
      const res = await offlineFetch(`/api/animals${query}`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!user?.email
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !!user?.email
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        animal_id: data.animal_ids && data.animal_ids.length > 0 ? data.animal_ids[0] : null,
        created_by: user?.email
      };

      // Limpeza profunda e robusta do payload
      const finalPayload = deepClean(payload) || {};

      console.log('[QuickAppointment] Sending payload:', finalPayload);
      return enqueueMutation('/api/appointments', { method: 'POST', body: finalPayload });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(res?.queued ? 'Atendimento enfileirado para sincronização' : 'Atendimento registrado com sucesso!');
      onClose();
      if (!res?.queued && res?.id) {
        window.location.href = createPageUrl('AppointmentDetail') + `?id=${res.id}`;
      }
    },
    onError: (err) => {
      toast.error('Erro ao criar atendimento: ' + (err.message || 'Erro desconhecido'));
    }
  });

  const clientProperties = properties.filter(p => compareIds(p.client_id, formData.client_id));
  const clientAnimals = animals.filter(a => 
    compareIds(a.client_id, formData.client_id) && 
    (!formData.property_id || compareIds(a.property_id, formData.property_id))
  );

  const selectedProperty = properties.find(p => compareIds(p.id, formData.property_id));
  const kmRateRaw = settings?.km_rate;
  const kmRateParsed = Number(String(kmRateRaw ?? '').replace(',', '.'));
  const kmRate = Number.isFinite(kmRateParsed) && kmRateParsed > 0 ? kmRateParsed : 2.5;
  const displacementCost = selectedProperty?.distance_km 
    ? (selectedProperty.distance_km * 2 * kmRate) 
    : 0;

  const totalProcedures = formData.procedures.reduce((sum, p) => sum + (p.value || 0), 0);
  const totalAmount = totalProcedures + displacementCost;

  const addProcedure = () => {
    if (newProcedure.name && newProcedure.value) {
      setFormData({
        ...formData,
        procedures: [...formData.procedures, { 
          name: newProcedure.name, 
          value: parseFloat(newProcedure.value) 
        }]
      });
      setNewProcedure({ name: '', value: '' });
    }
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...formData,
      total_procedures: totalProcedures,
      total_medications: 0,
      displacement_cost: displacementCost,
      total_amount: totalAmount
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.client_id;
      case 2: return formData.animal_ids.length > 0 || true; // Animals optional
      case 3: return formData.type;
      default: return true;
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      type: '',
      date: new Date().toISOString().slice(0, 16),
      client_id: '',
      property_id: '',
      animal_ids: [],
      procedures: [],
      medications: [],
      observations: '',
      status: 'em_andamento'
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-[var(--accent)] to-emerald-600">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
            <Zap className="w-6 h-6" />
            Atendimento Rápido
          </DialogTitle>
          <p className="text-white/80 text-sm mt-1">Fluxo simplificado em {step}/4 passos</p>
          
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Step 1: Client */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)]">Selecione o Cliente</h3>
                  <p className="text-sm text-[var(--text-muted)]">Quem é o proprietário?</p>
                </div>
              </div>
              
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  client_id: e.target.value, 
                  property_id: '',
                  animal_ids: []
                })}
                className="w-full h-14 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-lg"
              >
                <option value="" disabled>Selecione o cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id} className="py-3">
                    {client.name}
                  </option>
                ))}
              </select>

              {formData.client_id && clientProperties.length > 0 && (
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  className="w-full h-14 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-lg mt-4"
                >
                  <option value="" disabled>Propriedade (opcional)</option>
                  {clientProperties.map((property) => (
                    <option key={property.id} value={property.id} className="py-3">
                      {property.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 2: Animal */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <Milk className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)]">Selecione os Animais</h3>
                  <p className="text-sm text-[var(--text-muted)]">Opcional - pode pular este passo</p>
                </div>
              </div>
              
              {clientAnimals.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {clientAnimals.map((animal) => (
                    <label 
                      key={animal.id}
                      className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        formData.animal_ids.includes(animal.id)
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                          : 'bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border-color)]'
                      }`}
                    >
                      <Checkbox
                        checked={formData.animal_ids.includes(animal.id)}
                        onCheckedChange={() => {
                          setFormData({
                            ...formData,
                            animal_ids: formData.animal_ids.includes(animal.id)
                              ? formData.animal_ids.filter(id => id !== animal.id)
                              : [...formData.animal_ids, animal.id]
                          });
                        }}
                      />
                      <span className="font-medium text-[var(--text-primary)]">{animal.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <AnimalIcon species="outro" className="w-12 h-12 mx-auto mb-3 opacity-30" white={false} />
                  <p>Nenhum animal cadastrado para este cliente</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Type & Procedure */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)]">Tipo de Atendimento</h3>
                  <p className="text-sm text-[var(--text-muted)]">Qual o tipo do atendimento?</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`p-4 rounded-xl text-left transition-all border-2 ${
                      formData.type === type.value
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                        : 'bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border-color)]'
                    }`}
                  >
                    <span className="font-medium text-[var(--text-primary)]">{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Quick procedure add */}
              <div className="pt-4 border-t border-[var(--border-color)]">
                <Label className="text-sm font-medium mb-2 block">Adicionar Procedimento (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome"
                    value={newProcedure.name}
                    onChange={(e) => setNewProcedure({ ...newProcedure, name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="R$"
                    value={newProcedure.value}
                    onChange={(e) => setNewProcedure({ ...newProcedure, value: e.target.value })}
                    className="w-24"
                  />
                  <Button type="button" variant="outline" onClick={addProcedure} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.procedures.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.procedures.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm p-2 bg-[var(--bg-tertiary)] rounded-lg">
                        <span>{p.name}</span>
                        <span className="font-medium">R$ {p.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
                  <Save className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[var(--text-primary)]">Confirmar</h3>
                  <p className="text-sm text-[var(--text-muted)]">Revise e finalize o atendimento</p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[var(--bg-tertiary)] rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Cliente</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {clients.find(c => c.id === formData.client_id)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tipo</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {TYPES.find(t => t.value === formData.type)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Animais</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formData.animal_ids.length || 'Nenhum'}
                  </span>
                </div>
                <div className="border-t border-[var(--border-color)] pt-3 flex justify-between text-lg">
                  <span className="font-semibold text-[var(--accent)]">Total</span>
                  <span className="font-bold text-[var(--accent)]">
                    R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Optional observations */}
              <Accordion type="single" collapsible>
                <AccordionItem value="observations" className="border-0">
                  <AccordionTrigger className="text-sm text-[var(--text-muted)] hover:no-underline">
                    Adicionar observações
                  </AccordionTrigger>
                  <AccordionContent>
                    <Textarea
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={3}
                      className="mt-2"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button 
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1 h-12 rounded-xl bg-white border border-black text-black hover:bg-gray-100"
              >
                Voltar
              </Button>
            )}
            {step < 4 ? (
              <Button 
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex-1 h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium gap-2"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
          className="flex-1 h-12 rounded-xl bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black font-medium gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'Salvando...' : 'Finalizar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
