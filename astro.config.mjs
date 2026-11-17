import { defineConfig } from 'astro/config';

// Served from the custom domain aipauseledger.org (set in the repo's
// Settings → Pages). No `base`: the site lives at the domain root.
export default defineConfig({
  site: 'https://aipauseledger.org',
  trailingSlash: 'ignore',
});
