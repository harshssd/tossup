import type { MetadataRoute } from 'next'
import { platformDb } from '@/lib/platform/db'
import { SITE_URL } from '@/lib/site'

// Dynamic sitemap over the PUBLIC platform surfaces. The product plan's growth
// model is that players/viewers ARE the SEO network — until this file existed,
// none of the club/tournament/player pages were discoverable by crawlers except
// via links. Reads are anon (RLS: PUBLIC rows only) and capped.
export const revalidate = 3600

const CAP = 1000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: clubs }, { data: leagues }, { data: players }] = await Promise.all([
    platformDb
      .from('clubs')
      .select('slug, created_at')
      .eq('visibility', 'PUBLIC')
      .not('slug', 'is', null)
      .order('reputation_score', { ascending: false })
      .limit(CAP),
    platformDb
      .from('leagues')
      .select('id, created_at')
      .eq('visibility', 'PUBLIC')
      .order('created_at', { ascending: false })
      .limit(CAP),
    platformDb
      .from('player_profiles')
      .select('id, created_at')
      .eq('visibility', 'PUBLIC')
      .is('merged_into_id', null)
      .order('reputation_score', { ascending: false })
      .limit(CAP),
  ])

  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/discover`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/tournaments`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/start`, changeFrequency: 'monthly', priority: 0.7 },
  ]

  return [
    ...statics,
    ...(clubs ?? []).map((c) => ({
      url: `${SITE_URL}/club/${encodeURIComponent(c.slug as string)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...(leagues ?? []).map((l) => ({
      url: `${SITE_URL}/tournaments/${l.id}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...(players ?? []).map((p) => ({
      url: `${SITE_URL}/player/${p.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
