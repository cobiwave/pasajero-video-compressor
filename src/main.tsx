import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/fonts.css';
import './styles/globals.css';
import './App.css';

// Solo en dev: en el build `import.meta.env.DEV` es `false` y el import() se descarta.
const GridOverlay = import.meta.env.DEV
  ? lazy(() => import('./components/GridOverlay').then((m) => ({ default: m.GridOverlay })))
  : null;

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

createRoot(root).render(
  <StrictMode>
    <App />
    {GridOverlay && (
      <Suspense fallback={null}>
        <GridOverlay />
      </Suspense>
    )}
  </StrictMode>,
);
