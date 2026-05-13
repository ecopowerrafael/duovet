import React from 'react';
import { Button } from './ui/button';

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
      const { error, errorInfo } = this.state;
      return (
        <div style={{ padding: 32, color: 'red', background: '#fffbe9', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2>Erro detectado na aplicação</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 16 }}>{error?.message || error?.toString() || String(error)}</pre>
          {errorInfo?.componentStack && (
            <details style={{ marginTop: 16 }}>
              <summary>Stack trace</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 }}>{errorInfo.componentStack}</pre>
            </details>
          )}
          <p style={{ marginTop: 24, color: '#333', fontSize: 15 }}>Tire um print desta tela e envie para o desenvolvedor.</p>
          <div style={{ marginTop: 32 }}>
            <Button onClick={this.handleReload} variant="default" className="w-full sm:w-auto">
              Recarregar Página
            </Button>
            <Button onClick={this.handleReset} variant="outline" className="w-full sm:w-auto" style={{ marginLeft: 12 }}>
              Voltar ao Início
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
