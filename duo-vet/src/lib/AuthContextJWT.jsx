import React, { createContext, useState, useContext, useEffect } from 'react';
import { offlineFetch, isOnline, getAuthTokenAsync, setAuthToken, removeAuthToken, apiFetch, AUTH_EXPIRED_EVENT } from './offline';

const AuthContext = createContext();
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/privacy', '/termos', '/auth-callback'];

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();

    // Listen for auth expiration events from offline lib
    const handleAuthExpired = () => {
      console.log('Auth expired event received. Logging out...');
      setUser(null);
      setIsAuthenticated(false);
      const pathname = window.location.pathname || '/';
      if (!isPublicRoute(pathname)) {
        window.location.assign('/login');
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const checkAuth = async () => {
    await checkUserAuth();
  };

  // Login
  const login = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      if (!isOnline()) {
        throw new Error('Você precisa estar online para realizar o login');
      }
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error('Usuário ou senha inválidos');
      const data = await response.json();
      
      await setAuthToken(data.token);
      
      const userData = data.user;
      if (userData && userData.email === 'admin@duovet.app') {
        userData.role = 'admin';
      }
      setUser(userData);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      return true;
    } catch (error) {
      setAuthError({ type: 'login_error', message: error.message });
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return false;
    }
  };

  // Register
  const register = async (name, email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      if (!isOnline()) {
        throw new Error('Você precisa estar online para criar uma conta');
      }
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Register response not JSON:', text);
        throw new Error(`Erro de comunicação com o servidor (${response.status}). Verifique se a API está online.`);
      }

      if (!response.ok) throw new Error(data.error || 'Erro ao registrar');
      
      // Auto-login after register
      const loginSuccess = await login(email, password);
      return loginSuccess;
    } catch (error) {
      setAuthError({ type: 'register_error', message: error.message });
      setIsLoadingAuth(false);
      return false;
    }
  };

  // Checar usuário autenticado
  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const token = await getAuthTokenAsync();
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const data = await offlineFetch('/api/auth/me');
      if (!data) throw new Error('No user data');
      const userData = data.user || data;
      if (userData && userData.email === 'admin@duovet.app') {
        userData.role = 'admin';
      }
      setUser(userData);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Auth check error:', error);
      // O offlineFetch já cuida de disparar o logout em caso de 401
      // através do AUTH_EXPIRED_EVENT. Só precisamos resetar o estado local aqui
      // se o erro for impeditivo (como falta de cache).
      if (error.message && (error.message.includes('OFFLINE_NO_CACHE') || error.message.includes('[401]'))) {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    }
  };


  // Logout
  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await removeAuthToken();
    window.location.assign('/login');
  };

  // Redirecionar para login
  const navigateToLogin = () => {
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth, 
      authError, 
      login, 
      register, 
      logout,
      checkAuth,
      navigateToLogin 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
