import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so tests don't load the PWA plugin.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // component tests need a DOM; pure .ts tests run under it unchanged
    setupFiles: ['./src/test/setup.ts'],
  },
});
