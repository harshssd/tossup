import { ShieldCheck, Shield, Sprout, CircleHelp } from 'lucide-react'
import { TIER_META, type Tier } from '@/lib/platform/recognition'
import { cn } from '@/lib/utils'

// Recognition rendered as an earned "cap" — pale tint + tier-colored text.
const ICONS: Record<Tier, typeof ShieldCheck> = {
  OFFICIAL: ShieldCheck,
  AFFILIATED: Shield,
  COMMUNITY: Sprout,
  UNVERIFIED: CircleHelp,
}

interface Props {
  tier: Tier
  size?: 'sm' | 'md'
  className?: string
}

export function RecognitionBadge({ tier, size = 'sm', className }: Props) {
  const meta = TIER_META[tier] ?? TIER_META.UNVERIFIED
  const Icon = ICONS[tier] ?? CircleHelp
  return (
    <span
      title={meta.blurb}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.06em]',
        size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
        `ch-tier-${tier}`,
        className
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {meta.label}
    </span>
  )
}
