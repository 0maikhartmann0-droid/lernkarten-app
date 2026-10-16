import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Testet den fertigen Build (dist/), weil nur dort der Service Worker aktiv ist: erst "npm run build".
// Ohne heruntergeladenes Playwright-Chromium: PW_CHANNEL=msedge oder PW_CHANNEL=chrome setzen.
export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || undefined,
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
