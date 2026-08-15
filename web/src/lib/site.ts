// Canonical site origin for absolute URLs (sitemap, robots, metadataBase, OG).
// NEXT_PUBLIC_SITE_URL is set per environment; the fallback matches the
// production domain baked into the share-card branding.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tossup.app').replace(/\/+$/, '')
