import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function AndrologicalDataForm({ data = {}, onChange, readonly = false }) {
  const [formData, setFormData] = useState(data);

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange?.(updated);
  };

  return (
    <div className="space-y-4">
      {/* Volume */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Volume</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: 5mL, 4-6mL</p>
        <Input
          value={formData.volume || ''}
          onChange={(e) => handleChange('volume', e.target.value)}
          placeholder="Digite o volume"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Motility */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Motilidade</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: 85%, 80-90%</p>
        <Input
          value={formData.motility || ''}
          onChange={(e) => handleChange('motility', e.target.value)}
          placeholder="Digite a motilidade"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Vigor */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Vigor</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: 8/10, 7-9/10</p>
        <Input
          value={formData.vigor || ''}
          onChange={(e) => handleChange('vigor', e.target.value)}
          placeholder="Digite o vigor espermático"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Concentration per mL */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Concentração por mL</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: 1.500 x 10⁶, 1500 milhões</p>
        <Input
          value={formData.concentration_ml || ''}
          onChange={(e) => handleChange('concentration_ml', e.target.value)}
          placeholder="Digite a concentração por mL"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Total Concentration */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Concentração Total</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: 7.500 x 10⁶</p>
        <Input
          value={formData.total_concentration || ''}
          onChange={(e) => handleChange('total_concentration', e.target.value)}
          placeholder="Digite a concentração total"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Observations */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Observações Adicionais</Label>
        <textarea
          value={formData.observations || ''}
          onChange={(e) => handleChange('observations', e.target.value)}
          placeholder="Adicione observações sobre o exame"
          disabled={readonly}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
    </div>
  );
}