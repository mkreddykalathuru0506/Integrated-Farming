import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Samagra Krishi — Integrated Farm Manager',
        short_name: 'Samagra Krishi',
        description: 'Integrated farm management for India',
        lang: 'en',
        // Harvest palette: deep-pine sidebar (matches index.html meta theme-color)
        // over the warm bone canvas (--background: 42 38% 92% → #f2eee3).
        theme_color: '#123322',
        background_color: '#f2eee3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Manifest strings cannot be localised at runtime (manifest lang is 'en'),
        // so shortcut names stay English by design.
        shortcuts: [
          {
            name: 'Dashboard',
            url: '/',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Daily logs',
            url: '/daily',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: { port: 5180 },
  preview: { port: 5180 },
});
