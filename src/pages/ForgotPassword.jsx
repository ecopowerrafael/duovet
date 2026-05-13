import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { forgotPassword } from '../lib/api';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success('E-mail de recuperação enviado!');
    } catch (err) {
      toast.error('Erro ao enviar e-mail: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center">Recuperar Senha</h2>
        <p className="text-gray-600 text-center mb-6">
          {sent 
            ? 'Enviamos as instruções para o seu e-mail.' 
            : 'Informe seu e-mail para receber as instruções de recuperação.'}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-11 rounded-lg"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <p className="mb-6 text-sm text-gray-500">
              Se você não receber o e-mail em alguns minutos, verifique sua pasta de spam.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-green-600 font-bold hover:underline">
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
