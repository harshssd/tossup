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
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: false,
      },
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
