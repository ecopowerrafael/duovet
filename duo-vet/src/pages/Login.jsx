import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContextJWT';
import { getGoogleAuthUrl } from '../lib/offline';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export default function Login() {
  const { login, isLoadingAuth, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const googleAuthUrl = getGoogleAuthUrl();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await login(email, password);
    setSubmitting(false);
    if (success) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md border border-slate-100 overflow-hidden mb-4">
            <img src="/logo.png?v=1" alt="DuoVet Logo" className="w-full h-full object-contain p-2" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Duo<span className="text-emerald-600">Vet</span></h2>
          <p className="text-slate-500 font-medium mt-1">Bem-vindo de volta!</p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700">Senha</label>
            <Link to="/forgot-password" size="sm" className="text-sm text-green-600 font-medium hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <input
            type="password"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {authError && authError.type === 'login_error' && (
          <div className="mb-4 text-red-600 text-sm text-center">{authError.message}</div>
        )}
        <Button type="submit" className="w-full h-12 text-lg font-bold bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg" disabled={isLoadingAuth || submitting}>
          {isLoadingAuth || submitting ? 'Entrando...' : 'Entrar'}
        </Button>
        
        <div className="mt-4">
          <Button 
            type="button"
            className="w-full h-12 text-lg font-bold bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg flex items-center justify-center gap-2"
            onClick={() => window.location.href = googleAuthUrl}
            disabled={isLoadingAuth || submitting}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Entrar com Google
          </Button>
        </div>

        <div className="mt-6 text-center space-y-4">
          <p className="text-gray-600">Não tem uma conta? <Link to="/register" className="text-green-600 font-bold hover:underline">Cadastre-se</Link></p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-green-600 transition-colors">Privacidade</Link>
            <span>•</span>
            <Link to="/termos" className="hover:text-green-600 transition-colors">Termos de Uso</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
