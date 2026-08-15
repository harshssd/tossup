import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/signin?error=callback_error&message=${encodeURIComponent(error.message)}`
        )
      }

      // Land back where the user was headed (?next=, threaded through the OAuth
      // round-trip), else the auction hub — this is the AUCTION project's session,
      // so a platform page like /home would just show its sign-in gate (audit U2).
      const next = requestUrl.searchParams.get('next')
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/auctions'
      return NextResponse.redirect(`${requestUrl.origin}${dest}`)
    } catch (error) {
      console.error('Callback processing error:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/signin?error=processing_error`
      )
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/signin`)
}
