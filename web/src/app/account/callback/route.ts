import { NextRequest, NextResponse } from 'next/server'
import { createPlatformServerClient } from '@/lib/platform/auth-server'

// OAuth / email-confirmation callback for the platform project. Exchanges the
// code for a session (writing platform session cookies) then returns to the
// requested in-app path.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirectParam = url.searchParams.get('redirect') || '/discover'
  // Only allow same-origin in-app paths; reject protocol-relative (//evil) and
  // backslash forms.
  const redirect = /^\/(?![/\\])/.test(redirectParam) ? redirectParam : '/discover'

  if (code) {
    const supabase = await createPlatformServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${url.origin}/account/sign-in?error=${encodeURIComponent(error.message)}`)
    }
  }
  return NextResponse.redirect(`${url.origin}${redirect}`)
}
