import React from 'react';
import { X, Filter } from 'lucide-react';
import { Button } from "./ui/button";
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileFilterDrawer({ isOpen, onClose, children, activeFiltersCount = 0 }) {
  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-[var(--bg-card)] shadow-2xl z-50 overflow-y-auto"
          >
            {/* Header - iOS Style */}
            <div className="sticky top-0 bg-[var(--bg-card)]/95 backdrop-blur-xl border-b border-[var(--border-color)] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Filter className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="font-bold text-[var(--text-primary)] text-xl tracking-tight">Filtros</h3>
                {activeFiltersCount > 0 && (
                  <span className="bg-[var(--accent)] text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[24px] text-center">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 rounded-2xl hover:bg-[var(--bg-tertiary)]"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {children}
            </div>

            {/* Footer - iOS Style */}
            <div className="sticky bottom-0 bg-[var(--bg-card)]/95 backdrop-blur-xl border-t border-[var(--border-color)] p-5">
              <Button
                onClick={onClose}
                className="w-full h-14 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-2xl shadow-lg shadow-[#22c55e]/25 text-base"
              >
                Aplicar Filtros
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}