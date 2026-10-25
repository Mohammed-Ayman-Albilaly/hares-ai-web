import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { SpikePage } from './spike/SpikePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpikePage />
  </StrictMode>,
);
