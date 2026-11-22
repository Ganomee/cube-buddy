import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const port = 4179;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'draft-roster.spec.js',
  use: { baseURL: origin },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: origin,
  },
});
