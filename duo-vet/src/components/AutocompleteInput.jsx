import React, { useState, useRef, useEffect } from 'react';
import { Input } from "../components/ui/input";
import { Clock, Search } from 'lucide-react';

const DEFAULT_SUGGESTIONS = {
  medications: [
    'Ivermectina 1%',
    'Oxitetraciclina LA',
    'Banamine',
    'Dexametasona',
    'Penicilina',
    'Enrofloxacina',
    'Meloxicam',
    'Vitamina ADE',
    'Cálcio Injetável',
    'Ocitocina'
  ],
  diagnoses: [
    'Mastite clínica',
    'Pneumonia',
    'Diarreia',
    'Hipocalcemia',
    'Retenção de placenta',
    'Metrite',
    'Cisto ovariano',
    'Claudicação',
    'Tristeza parasitária',
    'Papilomatose'
  ],
  procedures: [
    'Consulta clínica',
    'Exame físico geral',
    'Aplicação de medicamento',
    'Coleta de sangue',
    'Ultrassonografia',
    'Diagnóstico de gestação',
    'Inseminação artificial',
    'Casqueamento',
    'Vacinação',
    'Vermifugação'
  ],
  observations: [
    'Animal em bom estado geral',
    'Retorno em 7 dias para reavaliação',
    'Manter em observação',
    'Isolamento recomendado',
    'Repouso de 24 horas',
    'Evitar movimentação excessiva',
    'Período de carência para abate',
    'Tratamento concluído com sucesso'
  ]
};

export default function AutocompleteInput({ 
  type = 'medications', // medications, diagnoses, procedures, observations
  value,
  onChange,
  placeholder,
  recentItems = [],
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const allSuggestions = [
    ...recentItems.slice(0, 5).map(item => ({ text: item, isRecent: true })),
    ...DEFAULT_SUGGESTIONS[type].map(item => ({ text: item, isRecent: false }))
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      const filtered = allSuggestions.filter(s => 
        s.text.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(allSuggestions.slice(0, 8));
    }
  }, [value]);

  const handleSelect = (text) => {
    onChange(text);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={className}
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      </div>
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(suggestion.text)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-3 border-b border-[var(--border-color)] last:border-0"
            >
              {suggestion.isRecent && (
                <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <span className="text-sm text-[var(--text-primary)]">{suggestion.text}</span>
              {suggestion.isRecent && (
                <span className="text-xs text-[var(--text-muted)] ml-auto">Recente</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}