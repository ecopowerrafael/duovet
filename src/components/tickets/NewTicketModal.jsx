import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

const CATEGORIES = [
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'tecnico', label: 'Suporte Técnico' },
  { value: 'integracoes', label: 'Integrações' },
  { value: 'conta', label: 'Conta e Acesso' }
];

export default function NewTicketModal({ open, onOpenChange, onSubmit, submitting }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [description, setDescription] = useState('');

  const errors = useMemo(() => {
    const next = {};
    if (!subject.trim()) next.subject = 'Informe o assunto';
    if (!category.trim()) next.category = 'Selecione uma categoria';
    if (!description.trim() || description.trim().length < 10) {
      next.description = 'Descreva o problema com pelo menos 10 caracteres';
    }
    return next;
  }, [subject, category, description]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) return;
    await onSubmit({
      subject: subject.trim(),
      category,
      description: description.trim()
    });
    setSubject('');
    setCategory(CATEGORIES[0].value);
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border border-[var(--border-color)] bg-white dark:bg-[#1a2130] dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-slate-100 text-lg font-semibold">Abrir Chamado de Suporte</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-black dark:text-slate-200 text-sm font-medium">Assunto *</Label>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex: Erro ao finalizar atendimento"
              className="border-2 border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400"
            />
            {errors.subject ? <p className="text-xs text-red-500">{errors.subject}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-black dark:text-slate-200 text-sm font-medium">Categoria *</Label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-xl border-2 border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            {errors.category ? <p className="text-xs text-red-500">{errors.category}</p> : null}
          </div>

          <div className="space-y-2">
            <Label className="text-black dark:text-slate-200 text-sm font-medium">Descrição *</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva detalhadamente o contexto e os passos para reproduzir o problema."
              className="min-h-[120px] border-2 border-gray-300 bg-white text-black placeholder-gray-500 focus:border-blue-500 rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400"
            />
            {errors.description ? <p className="text-xs text-red-500">{errors.description}</p> : null}
          </div>

          <DialogFooter className="flex gap-3 justify-end pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="rounded-xl border-2 border-gray-300 bg-white text-black hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || Object.keys(errors).length > 0} 
              className="rounded-xl border-2 border-black bg-white text-black hover:bg-gray-100 font-semibold disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {submitting ? 'Abrindo Chamado...' : 'Abrir Chamado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
