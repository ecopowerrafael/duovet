import React from 'react';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Tenta navegar para a home se possível, ou apenas limpa o erro
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-background)] p-6 text-center">
          <div className="bg-[var(--bg-card)] border border-red-200 rounded-2xl p-8 max-w-md shadow-xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Ops! Algo deu errado.
            </h1>
            <p className="text-[var(--text-muted)] mb-6">
              Ocorreu um erro inesperado ao carregar esta página. Nossa equipe já foi notificada.
            </p>
            
            {this.state.error && (
              <div className="mb-6 text-left bg-red-50 p-4 rounded-lg overflow-auto max-h-40 text-xs text-red-800 font-mono border border-red-100">
                <p className="font-bold mb-1">Detalhes do erro:</p>
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReload} variant="default" className="w-full sm:w-auto">
                Recarregar Página
              </Button>
              <Button onClick={this.handleReset} variant="outline" className="w-full sm:w-auto">
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
