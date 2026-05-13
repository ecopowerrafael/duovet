import React, { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Calendar, Clock } from 'lucide-react';
import { DateTimePicker } from '../ui/date-time-picker';

const RETURN_TYPES = [
  'Reavaliação clínica',
  'Acompanhamento',
  'Revisita técnica',
  'Controle pós-operatório',
  'Verificação de tratamento',
  'Outro',
];

export default function ReturnScheduler({ returnData, onChange, readonly = false }) {
  const [needsReturn, setNeedsReturn] = useState(returnData?.needs_return || false);
  
  // Combine date and time for DateTimePicker
  const [returnDateTime, setReturnDateTime] = useState(() => {
    if (returnData?.return_date && returnData?.return_time) {
      return `${returnData.return_date}T${returnData.return_time}`;
    }
    const now = new Date();
    const isoString = now.toISOString();
    return typeof isoString === 'string' ? isoString.slice(0, 16) : '';
  });

  useEffect(() => {
    setNeedsReturn(Boolean(returnData?.needs_return));
  }, [returnData?.needs_return]);

  useEffect(() => {
    if (returnData?.return_date && returnData?.return_time) {
      setReturnDateTime(`${returnData.return_date}T${returnData.return_time}`);
    }
  }, [returnData?.return_date, returnData?.return_time]);

  const handleReturnChange = (field, value) => {
    const updated = { ...returnData, needs_return: needsReturn, [field]: value };
    onChange(updated);
  };

  const handleDateTimeChange = (isoString) => {
    setReturnDateTime(isoString);
    if (typeof isoString === 'string') {
      const [date, time] = isoString.split('T');
      onChange({
        ...returnData,
        needs_return: true,
        return_date: date,
        return_time: time
      });
    }
  };

  const handleNeedsReturnChange = (value) => {
    setNeedsReturn(value);
    if (value) {
      const now = new Date();
      now.setDate(now.getDate() + 7); // Default to 1 week later
      const isoString = now.toISOString();
      const defaultDateTime = typeof isoString === 'string' ? isoString.slice(0, 16) : '';
      
      if (defaultDateTime) {
        const [date, time] = defaultDateTime.split('T');
        onChange({
          needs_return: true,
          return_date: date,
          return_time: time,
          return_type: '',
          return_notes: '',
        });
        setReturnDateTime(defaultDateTime);
      }
    } else {
      onChange({
        needs_return: false,
        return_date: null,
        return_time: null,
        return_type: null,
        return_notes: null,
      });
    }
  };

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader>
        <CardTitle className="text-lg text-[var(--text-primary)] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--accent)]" />
          Agendamento de Retorno
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pergunta principal */}
        <div className="space-y-3">
          <Label className="text-[var(--text-primary)] font-semibold">
            Será necessário realizar um retorno deste atendimento? *
          </Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="needs_return"
                checked={!needsReturn}
                onChange={() => handleNeedsReturnChange(false)}
                disabled={readonly}
                className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-[var(--text-primary)]">Não</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="needs_return"
                checked={needsReturn}
                onChange={() => handleNeedsReturnChange(true)}
                disabled={readonly}
                className="w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-[var(--text-primary)]">Sim</span>
            </label>
          </div>
        </div>

        {/* Campos de retorno */}
        {needsReturn && (
          <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            <div className="grid grid-cols-1 gap-4">
              <DateTimePicker
                label="Data e Horário Sugerido *"
                date={returnDateTime}
                setDate={handleDateTimeChange}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-primary)]">
                Tipo de Retorno *
              </Label>
              <select
                value={returnData?.return_type || ''}
                onChange={(e) => handleReturnChange('return_type', e.target.value)}
                disabled={readonly}
                required={needsReturn}
                className="w-full h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="" disabled>Selecione o tipo</option>
                {RETURN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-primary)]">
                Observações do Retorno
              </Label>
              <Textarea
                value={returnData?.return_notes || ''}
                onChange={(e) => handleReturnChange('return_notes', e.target.value)}
                placeholder="Ex: Verificar evolução da lesão, reavaliar resultado do exame, etc."
                disabled={readonly}
                className="bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] min-h-20"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg">
              <Clock className="w-4 h-4 text-[var(--accent)] mt-0.5" />
              <div className="text-xs text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)] mb-1">Notificações automáticas serão enviadas:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>24 horas antes do retorno</li>
                  <li>No dia do retorno (manhã)</li>
                  <li>1 hora antes (se houver horário definido)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
