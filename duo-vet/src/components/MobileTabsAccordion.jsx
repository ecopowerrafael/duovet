import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileTabsAccordion({ 
  isDarkMode, 
  tabs, 
  defaultTab = 0 
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-2">
      {tabs.map((tab, index) => (
        <div key={index}>
          {/* Tab Button */}
          <button
            onClick={() => setActiveTab(activeTab === index ? -1 : index)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all ${
              activeTab === index
                ? isDarkMode
                  ? 'bg-[#22c55e]/15 border border-[#22c55e]/30'
                  : 'bg-[#22c55e]/10 border border-[#22c55e]/30'
                : isDarkMode
                  ? 'bg-[#2a2a2d] border border-[#2a2a2d] hover:border-[#3a3a3d]'
                  : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className={`font-semibold text-[var(--text-primary)] text-left`}>
              {tab.label}
            </span>
            <motion.div
              animate={{ rotate: activeTab === index ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown 
                className={`w-5 h-5 ${
                  activeTab === index
                    ? 'text-[#22c55e]'
                    : 'text-[var(--text-muted)]'
                }`}
              />
            </motion.div>
          </button>

          {/* Tab Content */}
          <AnimatePresence>
            {activeTab === index && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className={`overflow-hidden mt-2 p-4 rounded-xl ${
                  isDarkMode ? 'bg-[#2a2a2d]/50' : 'bg-gray-50'
                }`}
              >
                {tab.content}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}