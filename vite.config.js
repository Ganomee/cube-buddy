import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        draftRoster: fileURLToPath(new URL('./draft-roster.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/ui.test.jsx'],
  },
});
