import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './application/auth';
import { StoreProvider } from './application/store';
import { App } from './ui/App';
import './ui/styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AuthProvider>
  </StrictMode>,
);
