import { profile } from '../lib/profile.js';

// Every public page. Capability pages come from profile.yaml, the rest are fixed routes.
export function GET({ site }) {
  const paths = ['/', '/work/', '/work/milansathi/', '/about/', ...profile.capabilities.map((c) => `/can/${c.slug}/`)];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
