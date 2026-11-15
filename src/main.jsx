import React from 'react'; import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css'; import App from './ScootNav.jsx';
import { startAutoUpdate } from './autoUpdate';
window.alert = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(window.__tt); window.__tt = setTimeout(() => { t.hidden = true; }, 2500); };
createRoot(document.getElementById('root')).render(<App />);
startAutoUpdate();
