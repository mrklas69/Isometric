import { defineConfig } from 'vite';

// Vite konfigurace — pro MVP minimum.
// Vite si všimne `index.html` v rootu, automaticky najde `src/main.ts` přes <script>.
export default defineConfig({
  // Dev server otevře app rovnou v prohlížeči.
  server: {
    open: true,
  },
});
