import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from './application/store';
import { App } from './ui/App';
import './ui/styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
