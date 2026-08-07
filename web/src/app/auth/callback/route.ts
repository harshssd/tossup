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

      // Phase F: legacy /dashboard retired → land on the platform home feed.
      return NextResponse.redirect(`${requestUrl.origin}/home`)
    } catch (error) {
      console.error('Callback processing error:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/signin?error=processing_error`
      )
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/signin`)
}
