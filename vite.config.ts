import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB
      },
      manifest: {
        name: 'Ink & Quill',
        short_name: 'InkQuill',
        description: 'A minimal markdown editor',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // More specific alias must precede the generic '@' prefix alias so
        // imports like '@core/commands/commandBus' resolve to src/core and are
        // not captured by the broader '@' -> repo-root mapping.
        '@core': path.resolve(__dirname, 'src/core'),
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR (Hot Module Replacement) — enabled by default.
      // Set DISABLE_HMR=true in .env to turn it off.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Polling-based file watching for environments where native fs events
      // are unreliable (e.g. WSL2, Docker, network drives on Windows).
      watch: process.env.VITE_POLL === 'true' ? { usePolling: true, interval: 500 } : undefined,
      // Proxy API requests to the Express server when running vite standalone.
      proxy: {
        '/api': {
          target: 'http://localhost:3009',
          changeOrigin: true,
        },
      },
    },
  };
});
