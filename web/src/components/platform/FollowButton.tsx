'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setFollow } from '@/lib/platform/follows-client'
import type { FollowScope } from '@/lib/platform/follows'

interface Props {
  scope: FollowScope
  scopeId: string
  signedIn: boolean
  following: boolean
  followerCount: number
  /** Where to return after sign-in when a signed-out visitor taps Follow. */
  redirectPath: string
  className?: string
}

export function FollowButton({ scope, scopeId, signedIn, following, followerCount, redirectPath, className }: Props) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(following)
  const [count, setCount] = useState(followerCount)
  const [busy, setBusy] = useState(false)

  // Re-seed from the server on router.refresh() — a soft nav reuses this instance,
  // so the useState initializers alone would go stale after a mutation.
  useEffect(() => {
    setIsFollowing(following)
    setCount(followerCount)
  }, [following, followerCount])

  async function toggle() {
    if (!signedIn) {
      router.push(`/account/sign-in?redirect=${encodeURIComponent(redirectPath)}`)
      return
    }
    const next = !isFollowing
    // Optimistic: flip button + count immediately, revert on failure.
    setIsFollowing(next)
    setCount((c) => Math.max(0, c + (next ? 1 : -1)))
    setBusy(true)
    try {
      await setFollow(scope, scopeId, next)
    } catch (err) {
      setIsFollowing(!next)
      setCount((c) => Math.max(0, c + (next ? -1 : 1)))
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <Button
        size="sm"
        variant={isFollowing ? 'outline' : 'default'}
        disabled={busy}
        onClick={toggle}
        aria-pressed={isFollowing}
        className={
          isFollowing
            ? 'gap-1.5 border-[#1f9d57] text-[#0f5a30] hover:bg-[#e7f4ec]'
            : 'gap-1.5 bg-[#1f9d57] text-white hover:bg-[#0f5a30]'
        }
      >
        <Heart className={`h-4 w-4 ${isFollowing ? 'fill-[#1f9d57]' : ''}`} aria-hidden />
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
      {count > 0 && (
        <span className="text-xs text-[#6f6c63]">
          {count.toLocaleString()} follower{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}
