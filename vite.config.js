import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' zorgt dat de app ook werkt in een submap, zoals op GitHub Pages
export default defineConfig({ plugins: [react()], base: './' });
