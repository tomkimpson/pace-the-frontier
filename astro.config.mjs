import { defineConfig } from 'astro/config';

// GitHub Pages project site. If you add a custom domain, set `site` to it
// and remove `base`.
export default defineConfig({
  site: 'https://tomkimpson.github.io',
  base: '/pace-the-frontier',
  trailingSlash: 'ignore',
});
