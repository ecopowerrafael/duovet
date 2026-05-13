import React, { useCallback, useImperativeHandle, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Plus, Trash2, Pill, Search } from 'lucide-react';
import { toast } from 'sonner';
import { compareIds, formatCurrency, parseCurrency } from '../../lib/utils';
import { offlineFetch } from '../../lib/offline';

const ADMINISTRATION_ROUTES = [
  'Oral',
  'Intramuscular (IM)',
  'Intravenosa (IV)',
  'Subcutânea (SC)',
  'Tópica',
  'Oftálmica',
  'Auricular',
  'Intrauterina',
  'Outra'
];

const PrescriptionForm = React.forwardRef(function PrescriptionForm({ medications = [], onChange, readonly = false }, ref) {
  const [newMedication, setNewMedication] = useState({
    product_id: '',
    name: '',
    active_ingredient: '',
    dosage: '',
    administration_route: '',
    frequency: '',
    duration: '',
    instructions: '',
    quantity: '',
    value: ''
  });
  const [stockSearch, setStockSearch] = useState('');

  const commitPendingMedication = useCallback(() => {
    if (readonly) return medications;
    if (!newMedication?.name) return medications;

    const alreadyAdded = (medications || []).some((m) => {
      if (!m) return false;
      if (newMedication.product_id) return compareIds(m.product_id, newMedication.product_id);
      return String(m.name || '').trim().toLowerCase() === String(newMedication.name || '').trim().toLowerCase();
    });

    if (alreadyAdded) return medications;

    const shouldDeductFromStock = newMedication.product_id
      ? window.confirm('Deseja dar baixa desta quantidade no estoque ao salvar?')
      : false;

    const nextMedications = [...(medications || []), {
      product_id: newMedication.product_id || null,
      name: newMedication.name,
      active_ingredient: newMedication.active_ingredient,
      dosage: newMedication.dosage || 'Conforme prescrição',
      administration_route: newMedication.administration_route,
      frequency: newMedication.frequency,
      duration: newMedication.duration,
      instructions: newMedication.instructions,
      quantity: parseFloat(newMedication.quantity) || 1,
      price: typeof newMedication.value === 'string' ? parseCurrency(newMedication.value) : parseFloat(newMedication.value) || 0,
      deduct_from_stock: shouldDeductFromStock
    }];

    onChange(nextMedications);
    setNewMedication({
      product_id: '',
      name: '',
      active_ingredient: '',
      dosage: '',
      administration_route: '',
      frequency: '',
      duration: '',
      instructions: '',
      quantity: '',
      value: ''
    });
    setStockSearch('');
    return nextMedications;
  }, [readonly, medications, newMedication, onChange]);

  useImperativeHandle(ref, () => ({ commitPendingMedication }), [commitPendingMedication]);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const me = await offlineFetch('/api/auth/me');
      return me?.user || me;
    }
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', user?.email],
    queryFn: async () => offlineFetch(`/api/inventory/products?created_by=${user?.email}`),
    enabled: !!user?.email && !readonly
  });

  const filteredProducts = (products || []).filter((product) => {
    if (!product) return false;
    const query = String(stockSearch || '').trim().toLowerCase();
    if (!query) return true;
    const name = String(product.name || '').toLowerCase();
    const description = String(product.description || '').toLowerCase();
    const category = String(product.category || '').toLowerCase();
    return name.includes(query) || description.includes(query) || category.includes(query);
  });

  const handleProductSelect = (productId) => {
    if (!productId) {
      setNewMedication({
        ...newMedication,
        product_id: '',
        name: '',
        active_ingredient: '',
        value: ''
      });
      setStockSearch('');
      return;
    }

    const product = products.find((p) => p && (compareIds(p.id, productId) || compareIds(p._id, productId)));
    if (product) {
      setNewMedication({
        ...newMedication,
        product_id: product.id || product._id,
        name: product.name,
        active_ingredient: product.description || '',
        dosage: newMedication.dosage || 'Conforme prescrição',
        value: formatCurrency((Number(product.sale_price || 0) * 100).toString())
      });
      setStockSearch('');
    }
  };

  const addMedication = () => {
    if (!newMedication.name) {
      toast.error('Selecione ou informe um medicamento');
      return;
    }

    const shouldDeductFromStock = newMedication.product_id
      ? window.confirm('Deseja dar baixa desta quantidade no estoque ao salvar o atendimento?')
      : false;

    onChange([...medications, {
      product_id: newMedication.product_id || null,
      name: newMedication.name,
      active_ingredient: newMedication.active_ingredient,
      dosage: newMedication.dosage || 'Conforme prescrição',
      administration_route: newMedication.administration_route,
      frequency: newMedication.frequency,
      duration: newMedication.duration,
      instructions: newMedication.instructions,
      quantity: parseFloat(newMedication.quantity) || 1,
      price: typeof newMedication.value === 'string' ? parseCurrency(newMedication.value) : parseFloat(newMedication.value) || 0,
      deduct_from_stock: shouldDeductFromStock
    }]);

    setNewMedication({
      product_id: '',
      name: '',
      active_ingredient: '',
      dosage: '',
      administration_route: '',
      frequency: '',
      duration: '',
      instructions: '',
      quantity: '',
      value: ''
    });
    setStockSearch('');
  };

  const removeMedication = (index) => {
    onChange(medications.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Medications List */}
      {medications.length > 0 && (
        <div className="space-y-3">
          {medications.map((med, index) => (
            <Card key={index} className="bg-[var(--bg-tertiary)] border-[var(--border-color)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-2">
                      <Pill className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-[var(--text-primary)]">{med.name}</h4>
                        {med.active_ingredient && (
                          <p className="text-sm text-[var(--text-muted)]">{med.active_ingredient}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      {med.dosage && (
                        <div>
                          <span className="text-[var(--text-muted)]">Dosagem:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{med.dosage}</span>
                        </div>
                      )}
                      {med.administration_route && (
                        <div>
                          <span className="text-[var(--text-muted)]">Via:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{med.administration_route}</span>
                        </div>
                      )}
                      {med.frequency && (
                        <div>
                          <span className="text-[var(--text-muted)]">Frequência:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{med.frequency}</span>
                        </div>
                      )}
                      {med.duration && (
                        <div>
                          <span className="text-[var(--text-muted)]">Duração:</span>
                          <span className="ml-2 text-[var(--text-primary)]">{med.duration}</span>
                        </div>
                      )}
                    </div>

                    {med.instructions && (
                      <p className="text-sm text-[var(--text-secondary)] italic">
                        {med.instructions}
                      </p>
                    )}

                    {med.price > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--text-muted)]">Qtd: {med.quantity}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span className="text-[var(--text-muted)]">Unit: R$ {(med.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span className="font-medium text-[var(--accent)]">
                          Total: R$ {((med.price || 0) * (med.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {med.product_id && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {med.deduct_from_stock === false ? 'Sem baixa automática no estoque' : 'Com baixa automática no estoque'}
                      </p>
                    )}
                  </div>

                  {!readonly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMedication(index)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Medication Form */}
      {!readonly && (
        <Card className="bg-[var(--bg-card)] border-2 border-dashed border-[var(--border-color)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Medicamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Buscar no Estoque (Opcional)
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <Input
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Digite para buscar no estoque..."
                    className="pl-10 rounded-xl mb-2"
                  />
                </div>
                {String(stockSearch || '').trim().length > 0 && (
                  <div className="mb-2 max-h-44 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
                        Nenhum produto encontrado
                      </div>
                    ) : (
                      filteredProducts.slice(0, 8).map((product) => {
                        const productId = product.id || product._id;
                        return (
                          <button
                            key={`search-${productId}`}
                            type="button"
                            onClick={() => handleProductSelect(productId)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] border-b border-[var(--border-color)] last:border-b-0"
                          >
                            <span className="text-[var(--text-primary)]">{product.name}</span>
                            <span className="ml-1 text-[var(--text-muted)]">({product.current_stock} {product.unit} em estoque)</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
                <select
                  value={newMedication.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Produto manual...</option>
                  {filteredProducts.length === 0 ? (
                    <option value="" disabled>Nenhum produto encontrado</option>
                  ) : (
                    filteredProducts.map((product) => (
                      <option key={product.id || product._id} value={product.id || product._id}>
                        {product.name} ({product.current_stock} {product.unit} em estoque)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <Label>Nome do Medicamento *</Label>
                <Input
                  id="medication-name-input"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                  placeholder="Ex: Ivermectina"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Princípio Ativo</Label>
                <Input
                  value={newMedication.active_ingredient}
                  onChange={(e) => setNewMedication({ ...newMedication, active_ingredient: e.target.value })}
                  placeholder="Ex: Ivermectina 1%"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Dosagem</Label>
                <Input
                  value={newMedication.dosage}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                  placeholder="Ex: 1ml/50kg"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Via de Administração</Label>
                <select
                  value={newMedication.administration_route}
                  onChange={(e) => setNewMedication({ ...newMedication, administration_route: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>Selecione</option>
                  {ADMINISTRATION_ROUTES.map((route) => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Frequência</Label>
                <Input
                  value={newMedication.frequency}
                  onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                  placeholder="Ex: A cada 12 horas"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Duração do Tratamento</Label>
                <Input
                  value={newMedication.duration}
                  onChange={(e) => setNewMedication({ ...newMedication, duration: e.target.value })}
                  placeholder="Ex: 7 dias"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={newMedication.quantity}
                  onChange={(e) => setNewMedication({ ...newMedication, quantity: e.target.value })}
                  placeholder="1"
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label>Valor Unitário</Label>
                <Input
                  value={newMedication.value}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setNewMedication({ ...newMedication, value: formatCurrency(value) });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMedication();
                      document.getElementById('medication-name-input')?.focus();
                    }
                  }}
                  placeholder="R$ 0,00"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label>Observações / Instruções de Uso</Label>
              <Textarea
                value={newMedication.instructions}
                onChange={(e) => setNewMedication({ ...newMedication, instructions: e.target.value })}
                placeholder="Ex: Administrar após a alimentação"
                rows={2}
                className="rounded-xl"
              />
            </div>

            <Button
              type="button"
              onClick={addMedication}
              className="w-full rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar à Prescrição
            </Button>
          </CardContent>
        </Card>
      )}

      {medications.length === 0 && readonly && (
        <div className="text-center py-8 text-[var(--text-muted)]">
          Nenhum medicamento prescrito
        </div>
      )}
    </div>
  );
});

export default PrescriptionForm;
