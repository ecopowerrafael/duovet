import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Menu } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MobileBottomMenu({ 
  isDarkMode, 
  onMenuOpen, 
  currentPageName,
  menuItems
}) {
  const isActive = (page) => currentPageName === page;

  // Bottom menu items: Dashboard, Agenda, Appointments, Animals, Menu
  const bottomMenuPages = ['dashboard', 'agenda', 'appointments', 'animals'];
  const bottomMenuItems = bottomMenuPages.map(page => menuItems.find(item => item.page === page)).filter(Boolean);

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`fixed bottom-0 left-0 right-0 h-24 md:hidden flex items-center justify-around border-t z-40 ${
        isDarkMode 
          ? 'bg-[#1a1a1d]/95 backdrop-blur-xl border-[#2a2a2d]/50' 
          : 'bg-white/95 backdrop-blur-xl border-gray-200/50'
      } shadow-[0_-2px_10px_rgba(0,0,0,0.05)]`}
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {bottomMenuItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.page);
        const isCentral = item.page === 'appointments';

        return (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-2xl transition-all ${
              isCentral
                ? isDarkMode
                  ? 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30 -mt-2 scale-110'
                  : 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20 -mt-2 scale-110'
                : active
                  ? isDarkMode
                    ? 'text-[#22c55e]'
                    : 'text-[#16a34a]'
                  : isDarkMode
                    ? 'text-[#8a8a8e]'
                    : 'text-[#6b7280]'
            }`}
          >
            {typeof Icon === 'function' ? (
              <Icon 
                className={`${isCentral ? 'w-6 h-6' : 'w-5 h-5'}`}
                strokeWidth={active ? 2.5 : 2}
                isDarkMode={isDarkMode}
              />
            ) : (
              <Icon 
                className={`${isCentral ? 'w-6 h-6' : 'w-5 h-5'}`}
                strokeWidth={active ? 2.5 : 2}
              />
            )}
            <span className={`text-[10px] font-medium ${active && !isCentral ? 'font-semibold' : ''}`}>
              {item.page === 'appointments' ? 'Atend.' : item.label}
            </span>
          </Link>
        );
      })}

      {/* Menu */}
      <button
        onClick={onMenuOpen}
        data-onboarding="mobile-open-menu"
        className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-2xl transition-all ${
          isDarkMode
            ? 'text-[#8a8a8e]'
            : 'text-[#6b7280]'
        }`}
      >
        <Menu className="w-5 h-5" strokeWidth={2} />
        <span className="text-[10px] font-medium">Menu</span>
      </button>
    </motion.div>
  );
}
