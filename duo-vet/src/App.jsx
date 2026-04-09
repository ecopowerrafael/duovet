import { Toaster } from "./components/ui/toaster"
import TrialExpiredOverlay from './components/TrialExpiredOverlay';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from './lib/query-client'
import NavigationTracker from './lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from './lib/AuthContextJWT';
import UserNotRegisteredError from './components/UserNotRegisteredError';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Native } from './lib/native';
import { useEffect } from 'react';
import { warmCache } from './lib/offline';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => {
  const { isAuthenticated } = useAuth();
  const noLayoutPages = ['login', 'register', 'forgot-password', 'reset-password', 'privacy', 'termos', 'landing', mainPageKey];
  
  // Se for a página inicial e não estiver autenticado, não mostra layout
  if (currentPageName === mainPageKey && !isAuthenticated) {
    return <>{children}</>;
  }

  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }
  return Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;
};

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/termos',
  '/auth-callback'
];

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  // Registrar PWA Service Worker
  useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    }
  });

  // Inicializar funções nativas e pré-carregar cache
  useEffect(() => {
    const initApp = async () => {
      // Funções nativas
      const info = await Native.getDeviceInfo();
      if (info.platform !== 'web') {
        console.log('Running on native platform:', info.platform);
        await Native.registerPush();
      }

      // Pré-carregar cache se estiver logado
      if (isAuthenticated && user?.email && user?.status !== 'expired') {
        const email = user.email;
        const isAdmin = email === 'admin@duovet.app';
        const queryParams = `created_by=${isAdmin ? '' : email}`;
        
        const coreUrls = [
          '/api/auth/me',
          `/api/animals?${queryParams}`,
          `/api/clients?${queryParams}`,
          `/api/properties?${queryParams}`,
          `/api/appointments?${queryParams}`,
          `/api/lots?${queryParams}`,
          `/api/events?${queryParams}`,
          `/api/payments?${queryParams}`,
          `/api/vetprofiles?${queryParams}`
        ];
        
        warmCache(coreUrls);
      }
    };
    initApp();
  }, [isAuthenticated, user?.email]);

  // Se autenticado e na raiz, redireciona para dashboard
  if (isAuthenticated && pathname === '/') {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading spinner while checking app public settings or auth
  // Skip for landing page to allow Google to index it immediately
  if (isLoadingAuth && pathname !== '/') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Se não autenticado e NÃO for uma rota pública, redireciona para login
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  
  if (!isAuthenticated && !isPublicRoute) {
    return <Navigate to="/login" replace />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Navigate to="/login" replace />;
    }
  }

  // Render the main app
  return (
    <ErrorBoundary>
      <TrialExpiredOverlay />
      <OfflineSyncBanner />
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        {/* Redirect for AdminPanel case sensitivity */}
        <Route path="/AdminPanel" element={<Navigate to="/admin-panel" replace />} />
        {/* Adiciona rota catch-all para 404 */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </ErrorBoundary>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
