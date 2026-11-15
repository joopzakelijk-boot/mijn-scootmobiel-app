import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Elke build krijgt een eigen versienummer. De app vergelijkt dat met version.json
// op de server en laadt zichzelf opnieuw als er een nieuwere versie online staat.
const BUILD_ID = String(Date.now());

const versionFile = () => ({
  name: 'scootnav-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  }
});

// base './' zorgt dat de app ook werkt in een submap, zoals op GitHub Pages
export default defineConfig({
  plugins: [react(), versionFile()],
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) }
});
