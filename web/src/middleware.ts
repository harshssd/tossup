import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const isLocalSupabase = supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')
  const connectSrc = isLocalSupabase
    ? `'self' ${supabaseUrl} ws://127.0.0.1:* wss://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://api.stripe.com`
    : `'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com`

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // Additional security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')

  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Remove potentially sensitive headers
  response.headers.delete('Server')
  response.headers.delete('X-Powered-By')

  return response
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

function isPublicRoute(pathname: string): boolean {
  // Exact-match routes
  if (pathname === '/') return true

  // Prefix-match routes (all subpaths are public)
  const publicPrefixes = [
    '/auth/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/live',
    '/explore',
    '/tournament',
    // Platform (community/discovery) public surfaces. Trailing slashes on
    // /club/ and /player/ avoid exposing the legacy /clubs dashboard route.
    '/discover',
    '/club/',
    '/player/',
    '/account',
    '/api/health',
    '/api/auth',
  ]

  return publicPrefixes.some(prefix => pathname.startsWith(prefix)) ||
         pathname.includes('/public/') ||
         pathname.includes('/_next/') ||
         pathname.includes('/favicon.ico')
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('/public/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  // Skip Supabase middleware if not configured properly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey ||
      supabaseUrl.includes('placeholder') ||
      supabaseAnonKey.includes('placeholder') ||
      supabaseUrl.includes('your-project') ||
      supabaseAnonKey.includes('your-anon-key') ||
      !supabaseUrl.startsWith('http')) {

    // Add security headers even when Supabase is not configured
    supabaseResponse = addSecurityHeaders(supabaseResponse)
    supabaseResponse.headers.set('x-request-id', crypto.randomUUID())

    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user for auth validation
    const { data: { user }, error } = await supabase.auth.getUser()

    // Authentication check for protected routes
    if (!isPublicRoute(pathname) && (error || !user)) {
      logger.warn('Unauthorized access attempt', {
        path: pathname,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent')
      })

      // Redirect to sign-in for protected pages
      if (!isApiRoute(pathname)) {
        const loginUrl = new URL('/auth/signin', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }

      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      )
    }

    // Forward user info as request headers for all API routes (when user is authenticated)
    if (isApiRoute(pathname) && user) {
      request.headers.set('x-user-id', user.id)
      request.headers.set('x-user-email', user.email || '')

      const newResponse = NextResponse.next({ request })

      // Preserve Supabase auth cookies on the response
      supabaseResponse.cookies.getAll().forEach(cookie => {
        newResponse.cookies.set(cookie)
      })

      supabaseResponse = newResponse
    }

    // refreshing the auth token
    await supabase.auth.getUser()
  } catch (error) {
    logger.error('Supabase middleware error', error as Error, {
      path: pathname,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    })
  }

  // Refresh the platform (tossup-cricket) session on platform routes so SSR
  // reads stay valid. Separate project => separate cookie name; scoped to
  // platform paths to avoid a second auth round-trip on every legacy request.
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL
  const platformKey = process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_ANON_KEY
  const isPlatformPath = ['/discover', '/club/', '/player/', '/tournament', '/account'].some(
    (p) => pathname.startsWith(p)
  )
  if (platformUrl && platformKey && isPlatformPath) {
    try {
      const platform = createServerClient(platformUrl, platformKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      })
      await platform.auth.getUser()
    } catch (error) {
      logger.error('Platform supabase middleware error', error as Error, { path: pathname })
    }
  }

  // Add security headers
  supabaseResponse = addSecurityHeaders(supabaseResponse)

  // Add request ID and timing headers
  const requestId = crypto.randomUUID()
  const duration = Date.now() - startTime

  supabaseResponse.headers.set('x-request-id', requestId)
  supabaseResponse.headers.set('x-response-time', `${duration}ms`)

  // CORS handling for API routes
  if (isApiRoute(pathname)) {
    const origin = request.headers.get('origin')
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ]

    if (origin && allowedOrigins.includes(origin)) {
      supabaseResponse.headers.set('Access-Control-Allow-Origin', origin)
      supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true')
      supabaseResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      )
      supabaseResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control'
      )
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: supabaseResponse.headers })
    }
  }

  // Log request for monitoring
  if (isApiRoute(pathname)) {
    logger.apiRequest(
      request.method,
      pathname,
      request.headers.get('x-user-id') || undefined,
      duration
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}