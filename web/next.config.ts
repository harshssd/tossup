import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  experimental: {
    optimizeCss: true,
  },

  // Turbopack configuration (empty to silence warnings)
  turbopack: {},

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  async headers() {
    // Applied to every route (including the embed widget).
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/(.*)', headers: baseSecurity },
      // Static fallback clickjacking protection everywhere EXCEPT the embed
      // widget (designed to be iframed on third-party club sites). The middleware
      // is the primary source — it sets a full CSP whose `frame-ancestors` is
      // `*` for /embed/* and `'none'` elsewhere; this rule just guarantees a
      // frame-busting header on normal routes even if the middleware is skipped.
      {
        source: '/((?!embed/).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ];
  },

  // Redirects for production
  async redirects() {
    // Phase F: retire the legacy auction-era community/dashboard surfaces (on the
    // legacy Supabase project) in favour of the platform equivalents. Temporary
    // (307/308-false) while the consolidation settles — promote to permanent once
    // stable. Redirects run BEFORE middleware, so these fire even for the
    // otherwise auth-gated /dashboard.
    // NOTE: only the legacy *index / discovery* surfaces are retired. The auction
    // product (which stays) still operates through the legacy league/club DEEP
    // routes — `/leagues/create`, `/leagues/[id]/dashboard`, `/clubs/create`,
    // `/clubs/[id]/*` — which feed `/auction/create` (?league=<id>). Blanket-
    // redirecting `/leagues/*` would dead-end auction creation, so those subpaths
    // are deliberately NOT redirected here.
    return [
      // Legacy auction-era discovery (browses the legacy DB) → platform discovery.
      { source: '/explore', destination: '/discover', permanent: false },
      // Legacy club deep-links live in a DIFFERENT database (different slug space),
      // so they can't map 1:1 — send them to the platform club index.
      { source: '/explore/club/:slug*', destination: '/discover?tab=clubs', permanent: false },
      // Index pages only (exact) — deep /clubs/* and /leagues/* stay on legacy.
      { source: '/clubs', destination: '/discover?tab=clubs', permanent: false },
      { source: '/leagues', destination: '/tournaments', permanent: false },
      { source: '/dashboard', destination: '/home', permanent: false },
      // /admin previously pointed at the now-retired /dashboard.
      { source: '/admin', destination: '/home', permanent: false },
    ];
  },


  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Compression
  compress: true,

  // PoweredBy header removal
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,


  // Output configuration for static exports if needed
  // output: 'export',
  // trailingSlash: true,


  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
