import React from 'react'; import { createRoot } from 'react-dom/client';
import './index.css'; import App from './ScootNav.jsx';
window.alert = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(window.__tt); window.__tt = setTimeout(() => { t.hidden = true; }, 2500); };
createRoot(document.getElementById('root')).render(<App />);
