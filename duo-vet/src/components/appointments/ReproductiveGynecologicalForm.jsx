import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function ReproductiveGynecologicalForm({ data = {}, onChange, readonly = false }) {
  const [formData, setFormData] = useState(data);

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange?.(updated);
  };

  return (
    <div className="space-y-4">
      {/* Cervix */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Cérvix</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: normal, edemaciada, com muco</p>
        <Input
          value={formData.cervix || ''}
          onChange={(e) => handleChange('cervix', e.target.value)}
          placeholder="Descreva o estado da cérvix"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Uterus */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Útero (UT)</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: normal, flácido, tônico</p>
        <Input
          value={formData.ut || ''}
          onChange={(e) => handleChange('ut', e.target.value)}
          placeholder="Descreva o estado do útero"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Left Ovary */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Ovário Esquerdo (OE)</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: folículo dominante, corpo lúteo</p>
        <Input
          value={formData.oe || ''}
          onChange={(e) => handleChange('oe', e.target.value)}
          placeholder="Descreva o estado do ovário esquerdo"
          disabled={readonly}
          className="bg-[var(--bg-tertiary)] border-[var(--border-color)]"
        />
      </div>

      {/* Right Ovary */}
      <div>
        <Label className="text-sm font-medium text-[var(--text-primary)]">Ovário Direito (OD)</Label>
        <p className="text-xs text-[var(--text-muted)] mb-2">Ex: folículo dominante, quiescente</p>
        <Input
          value={formData.od || ''}
          onChange={(e) => handleChange('od', e.target.value)}
          placeholder="Descreva o estado do ovário direito"
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
          placeholder="Adicione observações sobre o exame ginecológico"
          disabled={readonly}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
    </div>
  );
}