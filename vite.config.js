import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Firebase is often a large dependency; keep major areas separate.
          if (id.includes('/firebase/auth') || id.includes('/@firebase/auth')) return 'firebase-auth';
          if (id.includes('/firebase/firestore') || id.includes('/@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('/firebase/storage') || id.includes('/@firebase/storage')) return 'firebase-storage';
          if (id.includes('/firebase/analytics') || id.includes('/@firebase/analytics')) return 'firebase-analytics';
          if (id.includes('/firebase/')) return 'firebase-core';

          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'react';
          }
          if (id.includes('/react-router/') || id.includes('/react-router-dom/')) return 'router';
          if (id.includes('/lucide-react/')) return 'icons';
          if (id.includes('/date-fns/')) return 'date-fns';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';
          if (id.includes('/dompurify/')) return 'dompurify';

          // Fall back to per-package chunks to avoid a single mega vendor chunk.
          const rel = id.split('node_modules/')[1];
          if (!rel) return 'vendor';
          const parts = rel.split('/');
          const pkgName = rel.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
          const safe = pkgName.replace(/^@/, '').replaceAll('/', '-');
          return `vendor-${safe}`;
        },
      },
    },
  },
  server: {
    headers: {
      // Allow popups for Firebase OAuth without COOP warnings
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    }
  }
})
