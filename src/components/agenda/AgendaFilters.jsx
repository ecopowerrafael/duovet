import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_TYPES = {
  atendimento: 'Atendimento',
  preventivo: 'Preventivo',
  consultoria: 'Consultoria',
  retorno: 'Retorno',
  pessoal: 'Pessoal',
  bloqueio: 'Bloqueio'
};

export default function AgendaFilters({ 
  filterType, 
  onFilterTypeChange, 
  searchTerm, 
  onSearchChange, 
  isMobile 
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <motion.button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#22c55e]/10 dark:bg-[#22c55e]/20 text-[#22c55e] dark:text-[#22c55e] hover:bg-[#22c55e]/20 dark:hover:bg-[#22c55e]/30 transition-colors text-sm font-medium"
        >
          <Filter className="w-4 h-4" />
          Filtros
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Filtros</h3>
                  <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Buscar</label>
                    <Input
                      placeholder="Buscar evento..."
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="rounded-lg bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Tipo de Evento</label>
                    <select
                      value={filterType}
                      onChange={(e) => onFilterTypeChange(e.target.value)}
                      className="w-full h-10 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      <option value="all">Todos os tipos</option>
                      {Object.entries(EVENT_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  onClick={() => setIsOpen(false)}
                  className="w-full mt-6 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg h-11 font-medium"
                >
                  Aplicar Filtros
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="w-40 h-10 pl-9 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white pr-3 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
        >
          <option value="all">Todos</option>
          {Object.entries(EVENT_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <Input
        placeholder="Buscar..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-48 rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
      />
    </div>
  );
}