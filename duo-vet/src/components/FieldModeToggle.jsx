import React from 'react';
import { Sun, Smartphone } from 'lucide-react';
import { Switch } from "../components/ui/switch";

export default function FieldModeToggle({ isFieldMode, onToggle }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      isFieldMode 
        ? 'bg-amber-500/20 border border-amber-500/30' 
        : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        isFieldMode ? 'bg-amber-500' : 'bg-[var(--bg-secondary)]'
      }`}>
        {isFieldMode ? (
          <Sun className="w-5 h-5 text-white" />
        ) : (
          <Smartphone className="w-5 h-5 text-[var(--text-muted)]" />
        )}
      </div>
      <div className="flex-1">
        <p className={`font-semibold text-sm ${isFieldMode ? 'text-amber-200' : 'text-[var(--text-primary)]'}`}>
          Modo Campo
        </p>
        <p className={`text-xs ${isFieldMode ? 'text-amber-300/70' : 'text-[var(--text-muted)]'}`}>
          Interface otimizada para uso externo
        </p>
      </div>
      <Switch 
        checked={isFieldMode}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-amber-500"
      />
    </div>
  );
}