import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages serves this from /basketballcareer/, so the production build
 * needs that base path or every asset 404s. Dev stays at the root.
 */
const BASE = process.env.GITHUB_PAGES === 'true' ? '/basketballcareer/' : '/';

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    setupFiles: ['./src/verify/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
