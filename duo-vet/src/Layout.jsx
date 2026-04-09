import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from './lib/AuthContextJWT';
// Base44 removido: substituído por mocks/local logic
import {
  LogOut,
  WifiOff,
  Sun,
  Moon,
  Menu,
  TrendingUp,
  Package,
  ShieldCheck,
  LifeBuoy
} from 'lucide-react';
import NotificationBell from './components/notifications/NotificationBell';
import MobileBottomMenu from './components/MobileBottomMenu';
import OnboardingGuide from './components/onboarding/OnboardingGuide';
import { Toaster } from "./components/ui/sonner";
import { motion, AnimatePresence } from 'framer-motion';

// Ícone customizado para animais
const AnimalIcon = ({ className, ...props }) => (
  <svg className={className} viewBox="0 0 512 512" fill="currentColor" {...props}>
    <path d="M461.3 104.1c-11.8-29.4-35.3-44.1-58.8-44.1-8.2 0-16.5 1.8-24.7 5.3-41.2 17.6-67.6 58.8-82.4 97.6-14.7 38.8-20.6 77.6-26.5 116.5-2.9 20.6-5.9 41.2-11.8 61.8-11.8-14.7-23.5-29.4-35.3-44.1-23.5-29.4-47.1-58.8-76.5-79.4-20.6-14.7-44.1-23.5-67.6-23.5-5.9 0-11.8 0-17.6 2.9-35.3 8.8-58.8 44.1-52.9 79.4 5.9 32.4 26.5 58.8 50 79.4 23.5 20.6 50 35.3 76.5 50 52.9 26.5 105.9 52.9 161.8 73.5 14.7 5.9 29.4 11.8 44.1 14.7 5.9 0 11.8 2.9 17.6 2.9 23.5 0 44.1-8.8 61.8-26.5 17.6-17.6 29.4-41.2 32.4-67.6 8.8-67.6 14.7-135.3 20.6-202.9 2.9-29.4 5.9-58.8 14.7-85.3 2.9-8.8 2.9-17.6-2.9-26.5-2.9-2.9-5.9-2.9-8.8-5.9-2.9 0-5.9 0-8.8 2.9-2.9 2.9-5.9 5.9-5.9 8.8-8.8 26.5-11.8 55.9-14.7 85.3-5.9 67.6-11.8 135.3-20.6 202.9-2.9 20.6-11.8 38.8-26.5 52.9-14.7 14.7-32.4 20.6-52.9 17.6-11.8-2.9-23.5-5.9-35.3-11.8-52.9-20.6-105.9-44.1-155.9-70.6-26.5-14.7-50-29.4-70.6-47.1-20.6-17.6-38.8-38.8-41.2-64.7-2.9-23.5 11.8-47.1 35.3-52.9 2.9 0 5.9-2.9 8.8-2.9 17.6 0 35.3 5.9 50 17.6 26.5 17.6 47.1 44.1 67.6 70.6 14.7 17.6 29.4 35.3 44.1 52.9 8.8 11.8 26.5 11.8 35.3 2.9 8.8-8.8 8.8-26.5 2.9-35.3-5.9-8.8-8.8-17.6-11.8-26.5-5.9-20.6-8.8-41.2-11.8-61.8-5.9-38.8-11.8-79.4-26.5-116.5-14.7-38.8-38.8-76.5-76.5-91.2-5.9-2.9-11.8-2.9-17.6-2.9-14.7 0-29.4 8.8-38.8 26.5-5.9 11.8-5.9 23.5-2.9 35.3z"/>
  </svg>
);

const menuItems = [
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/f01162079_dashboard.png" 
        alt="Dashboard" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Dashboard', 
    page: 'dashboard' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/2e2c15884_agenda.png" 
        alt="Agenda" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Agenda', 
    page: 'agenda' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/f3d660622_atendimento.png" 
        alt="Atendimentos" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Atendimentos', 
    page: 'appointments' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/9c686442f_consultorias.png" 
        alt="Consultorias" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Consultorias', 
    page: 'consultorias' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/ea6f20023_cliente.png" 
        alt="Clientes" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Clientes', 
    page: 'clients' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/06de54c27_animais.png" 
        alt="Animais" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Animais', 
    page: 'animals' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/bf14a751b_prescricao.png" 
        alt="Prescrições" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Prescrições', 
    page: 'prescriptions' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/7dc523c54_relatorios.png" 
        alt="Relatórios" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Relatórios', 
    page: 'reports' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/bc1698123_financeiro.png" 
        alt="Financeiro" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Financeiro', 
    page: 'financial' 
  },
  { 
    icon: Package, 
    label: 'Estoque', 
    page: 'inventory' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/19367ddce_Notafiscal.png" 
        alt="Notas Fiscais" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Notas Fiscais', 
    page: 'invoices' 
  },
  { 
    icon: ShieldCheck, 
    label: 'Painel Admin', 
    page: 'admin-panel' 
  },
  {
    icon: LifeBuoy,
    label: 'Suporte',
    page: 'tickets'
  },
  { 
    icon: TrendingUp, 
    label: 'Assinatura', 
    page: 'my-subscription' 
  },
  { 
    icon: ({ className, isDarkMode }) => (
      <img 
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697bf59bd017f1e4d3629335/1403036cb_perfil.png" 
        alt="Perfil" 
        className={className}
        style={{ 
          objectFit: 'contain',
          filter: isDarkMode ? 'invert(1) brightness(2)' : 'none'
        }}
      />
    ), 
    label: 'Perfil', 
    page: 'settings' 
  },
];

export default function Layout({ children, currentPageName }) {
  const { logout, user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      if (window.innerWidth >= 1280) {
        setIsMobileMenuOpen(false);
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className={`min-h-screen flex w-full overflow-x-hidden ${isDarkMode ? 'bg-[#121214]' : 'bg-[#f8f9fa]'}`}>
      {/* Sidebar Desktop */}
      <aside className={`hidden xl:flex flex-col w-[240px] ${isDarkMode ? 'bg-[#1a1a1d]' : 'bg-white'} fixed h-full z-50 shadow-xl`}>
        {/* Logo */}
        <div className={`h-16 flex items-center px-5 ${isDarkMode ? 'border-b border-[#2a2a2d]' : 'border-b border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
              <img src="/logo.png?v=1" alt="Duo Vet Logo" className="w-full h-full object-contain p-1" />
            </div>
            <span className={`font-bold text-2xl tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Duo<span className="text-[#22c55e]">Vet</span>
            </span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="duovet-menu-scroll flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-1">
            {menuItems
              .filter(item => item.page !== 'admin-panel' || user?.role === 'admin')
              .map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;
              
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  data-onboarding={`menu-${item.page}-desktop`}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                    ${isActive 
                      ? isDarkMode 
                        ? 'bg-[#22c55e]/12 text-[#22c55e] shadow-sm' 
                        : 'bg-[#22c55e]/10 text-[#16a34a] shadow-sm'
                      : isDarkMode
                        ? 'text-[#b4b4b8] hover:text-white hover:bg-[#2a2a2d] hover:shadow-sm'
                        : 'text-[#6b7280] hover:text-gray-900 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#22c55e] rounded-r-full shadow-lg shadow-[#22c55e]/50"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                  {typeof Icon === 'function' ? (
                    <Icon 
                      className="w-[19px] h-[19px] transition-transform duration-200 group-hover:scale-110" 
                      strokeWidth={isActive ? 2.5 : 2}
                      isDarkMode={isDarkMode}
                    />
                  ) : (
                    <Icon 
                      className="w-[19px] h-[19px] transition-transform duration-200 group-hover:scale-110" 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  )}
                  <span className={`text-[14px] ${isActive ? 'font-semibold' : 'font-medium'} tracking-tight`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        
        {/* Bottom Section */}
        <div className={`p-3 ${isDarkMode ? 'border-t border-[#2a2a2d]' : 'border-t border-gray-100'}`}>
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl mb-2 transition-all duration-200 hover:shadow-sm ${
              isDarkMode 
                ? 'text-[#b4b4b8] hover:text-white hover:bg-[#2a2a2d]' 
                : 'text-[#6b7280] hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              {isDarkMode ? <Moon className="w-[19px] h-[19px]" /> : <Sun className="w-[19px] h-[19px]" />}
              <span className="text-[14px] font-medium tracking-tight">{isDarkMode ? 'Modo Escuro' : 'Modo Claro'}</span>
            </div>
            <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all duration-300 ${
              isDarkMode ? 'bg-[#22c55e] shadow-inner' : 'bg-gray-300 shadow-inner'
            }`}>
              <motion.div 
                className="w-4 h-4 bg-white rounded-full shadow-md"
                animate={{ x: isDarkMode ? 14 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            </div>
          </button>
          
          {/* Online Status */}
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2 ${
            isOnline 
              ? isDarkMode ? 'bg-[#22c55e]/8 border border-[#22c55e]/20' : 'bg-green-50 border border-green-100' 
              : isDarkMode ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'
          }`}>
            {isOnline ? (
              <>
                <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse shadow-sm shadow-[#22c55e]/50" />
                <span className={`text-xs font-semibold tracking-tight ${isDarkMode ? 'text-[#22c55e]' : 'text-green-600'}`}>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className={`text-xs font-semibold tracking-tight ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Offline</span>
              </>
            )}
          </div>
          
          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:shadow-sm group ${
              isDarkMode 
                ? 'text-[#b4b4b8] hover:text-red-400 hover:bg-red-500/10' 
                : 'text-[#6b7280] hover:text-red-600 hover:bg-red-50'
            }`}
          >
            <LogOut className="w-[19px] h-[19px] transition-transform duration-200 group-hover:scale-110" />
            <span className="text-[14px] font-medium tracking-tight">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header - iOS Style */}
      <header className={`md:hidden fixed top-0 left-0 right-0 h-16 ${isDarkMode ? 'bg-[#1a1a1d]/95 backdrop-blur-xl border-b border-[#2a2a2d]/50' : 'bg-white/95 backdrop-blur-xl border-b border-gray-200/50'} z-50 flex items-center justify-between px-5 shadow-sm`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-onboarding="mobile-open-menu"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`h-10 w-10 rounded-xl border transition-colors flex items-center justify-center ${isDarkMode ? 'border-[#2a2a2d] text-white hover:bg-[#2a2a2d]' : 'border-gray-200 text-gray-900 hover:bg-gray-100'}`}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
            <img src="/logo.png" alt="Duo Vet Logo" className="w-full h-full object-cover" />
          </div>
          <span className={`font-semibold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Duo<span className="text-[#22c55e]">Vet</span>
          </span>
        </div>
        
        <NotificationBell />
      </header>

      {/* Tablet Header */}
      <header className={`hidden md:flex xl:hidden fixed top-0 left-0 right-0 h-16 ${isDarkMode ? 'bg-[#1a1a1d]/95 backdrop-blur-xl border-b border-[#2a2a2d]/50' : 'bg-white/95 backdrop-blur-xl border-b border-gray-200/50'} z-50 items-center justify-between px-5 shadow-sm`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-onboarding="mobile-open-menu"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`h-10 w-10 rounded-xl border transition-colors flex items-center justify-center ${isDarkMode ? 'border-[#2a2a2d] text-white hover:bg-[#2a2a2d]' : 'border-gray-200 text-gray-900 hover:bg-gray-100'}`}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
              <img src="/logo.png" alt="Duo Vet Logo" className="w-full h-full object-cover" />
            </div>
            <span className={`font-semibold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Duo<span className="text-[#22c55e]">Vet</span>
            </span>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* Mobile Bottom Menu */}
      <MobileBottomMenu 
        isDarkMode={isDarkMode} 
        onMenuOpen={() => setIsMobileMenuOpen(true)}
        currentPageName={currentPageName}
        menuItems={menuItems}
      />

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="xl:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 pb-20"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.nav
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={`duovet-menu-scroll xl:hidden fixed left-0 top-0 bottom-0 w-[280px] md:w-[320px] h-screen overflow-y-auto ${isDarkMode ? 'bg-[#1a1a1d] shadow-2xl' : 'bg-white shadow-xl'} z-50`}
              style={{ paddingBottom: '80px' }}
            >
              {/* Mobile Logo */}
              <div className={`h-14 flex items-center px-4 ${isDarkMode ? 'border-b border-[#2a2a2d]' : 'border-b border-gray-100'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
                    <img src="/logo.png" alt="Duo Vet Logo" className="w-full h-full object-cover" />
                  </div>
                  <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Duo<span className="text-[#22c55e]">Vet</span>
                  </span>
                </div>
              </div>
              
              {/* Mobile Menu Items */}
              <div className="py-4 px-3">
                <div className="space-y-1">
                  {menuItems
                    .filter(item => item.page !== 'admin-panel' || user?.role === 'admin')
                    .map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPageName === item.page;
                    
                    return (
                      <Link
                        key={item.page}
                        to={createPageUrl(item.page)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        data-onboarding={`menu-${item.page}-mobile`}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all
                          ${isActive 
                            ? isDarkMode
                              ? 'bg-[#22c55e]/15 text-[#22c55e]'
                              : 'bg-[#22c55e]/10 text-[#16a34a]'
                            : isDarkMode
                              ? 'text-[#a1a1aa] hover:bg-[#27272a]'
                              : 'text-[#6b7280] hover:bg-gray-50'
                          }`}
                      >
                        {typeof Icon === 'function' ? (
                          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} isDarkMode={isDarkMode} />
                        ) : (
                          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                        )}
                        <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              
              {/* Mobile Bottom */}
              <div className={`p-3 ${isDarkMode ? 'border-t border-[#2a2a2d]' : 'border-t border-gray-100'}`}>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg mb-2 ${
                    isDarkMode 
                      ? 'text-[#a1a1aa] hover:bg-[#27272a]' 
                      : 'text-[#6b7280] hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    <span className="text-sm font-medium">{isDarkMode ? 'Modo Escuro' : 'Modo Claro'}</span>
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg ${
                    isDarkMode 
                      ? 'text-red-400 hover:bg-red-500/10' 
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Sair da conta</span>
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 min-w-0 xl:ml-[240px] pt-16 xl:pt-0 pb-24 md:pb-0 min-h-screen overflow-x-hidden ${isDarkMode ? 'bg-[#16161a]' : 'bg-[#f8f9fa]'}`}>
        {/* Offline Banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className={`flex items-center justify-center gap-2 bg-amber-500 ${isDarkMode ? 'text-black' : 'text-black'} py-2 text-sm font-medium`}>
                <WifiOff className="w-4 h-4" />
                <span>Modo offline — Dados serão sincronizados automaticamente</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="w-full p-5 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <motion.div
          key={currentPageName}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={isDarkMode ? 'text-white' : 'text-gray-900'}
          >
              {/* Theme CSS Variables */}
              <div className={isDarkMode ? 'duovet-dark' : 'duovet-light'}>
              <style>{`
                .duovet-dark {
                  --bg-primary: #16161a;
                  --bg-secondary: #1a1a1d;
                  --bg-tertiary: #2a2a2d;
                  --bg-card: #1a1a1d;
                  --border-color: #2a2a2d;
                  --text-primary: #fafafa;
                  --text-secondary: #b4b4b8;
                  --text-muted: #8a8a8e;
                  --accent: #22c55e;
                  --accent-hover: #16a34a;
                  --accent-bg: rgba(34, 197, 94, 0.08);
                }
                .duovet-light {
                  --bg-primary: #f8f9fa;
                  --bg-secondary: #ffffff;
                  --bg-tertiary: #f3f4f6;
                  --bg-card: #ffffff;
                  --border-color: #e5e7eb;
                  --text-primary: #111827;
                  --text-secondary: #6b7280;
                  --text-muted: #9ca3af;
                  --accent: #16a34a;
                  --accent-hover: #15803d;
                  --accent-bg: rgba(22, 163, 74, 0.1);
                }

                .duovet-menu-scroll {
                  scrollbar-width: thin;
                }
                .duovet-dark .duovet-menu-scroll {
                  scrollbar-color: #2a2a2d #111318;
                }
                .duovet-light .duovet-menu-scroll {
                  scrollbar-color: #16a34a #eef2f7;
                }
                .duovet-menu-scroll::-webkit-scrollbar {
                  width: 10px;
                }
                .duovet-menu-scroll::-webkit-scrollbar-track {
                  border-radius: 999px;
                  margin: 8px 0;
                }
                .duovet-dark .duovet-menu-scroll::-webkit-scrollbar-track {
                  background: linear-gradient(180deg, #111318 0%, #171a20 100%);
                  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
                }
                .duovet-light .duovet-menu-scroll::-webkit-scrollbar-track {
                  background: linear-gradient(180deg, #f3f6fb 0%, #edf2f7 100%);
                  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
                }
                .duovet-menu-scroll::-webkit-scrollbar-thumb {
                  border-radius: 999px;
                  border: 2px solid transparent;
                  background-clip: padding-box;
                  transition: background 0.25s ease, box-shadow 0.25s ease;
                }
                .duovet-dark .duovet-menu-scroll::-webkit-scrollbar-thumb {
                  background: linear-gradient(180deg, #3a3a3d 0%, #2a2a2d 100%);
                  box-shadow: 0 0 0 1px rgba(42, 42, 45, 0.5), 0 6px 14px rgba(0, 0, 0, 0.3);
                }
                .duovet-light .duovet-menu-scroll::-webkit-scrollbar-thumb {
                  background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
                  box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.25), 0 6px 12px rgba(21, 128, 61, 0.18);
                }
                .duovet-dark .duovet-menu-scroll::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(180deg, #4a4a4d 0%, #3a3a3d 100%);
                }
                .duovet-light .duovet-menu-scroll::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
                }
                .duovet-menu-scroll::-webkit-scrollbar-corner {
                  background: transparent;
                }

                /* Tipografia refinada */
                body {
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  text-rendering: optimizeLegibility;
                }

                /* Scrollbar customizada dark mode */
                .duovet-dark ::-webkit-scrollbar {
                  width: 8px;
                  height: 8px;
                }
                .duovet-dark ::-webkit-scrollbar-track {
                  background: #1a1a1d;
                }
                .duovet-dark ::-webkit-scrollbar-thumb {
                  background: #2a2a2d;
                  border-radius: 4px;
                }
                .duovet-dark ::-webkit-scrollbar-thumb:hover {
                  background: #3a3a3d;
                }

                /* Ocultar badge Base44 */
                #BASE44-badge {
                  display: none !important;
                }

                /* Ícones brancos em modo claro */
                .duovet-light .filter-white-in-light {
                  filter: brightness(0) invert(1);
                }
              `}</style>
              {children}
              </div>
              </motion.div>
              </div>
              </main>
      
      <Toaster 
        position="top-right"
        theme={isDarkMode ? 'dark' : 'light'}
        toastOptions={{
          className: 'shadow-lg',
          style: {
            background: isDarkMode ? '#18181b' : 'white',
            border: isDarkMode ? '1px solid #27272a' : '1px solid #e5e7eb',
            borderRadius: '10px',
            color: isDarkMode ? '#fafafa' : '#111827',
          }
        }}
      />
      <OnboardingGuide
        currentPageName={currentPageName}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      </div>
      );
      }
