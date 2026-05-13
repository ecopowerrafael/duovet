import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ptBR } from 'date-fns/locale';
import { setDefaultOptions } from 'date-fns';
import { initOffline } from './lib/offline';

setDefaultOptions({ locale: ptBR });

// Inicializar sistema offline antes do render
initOffline().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
