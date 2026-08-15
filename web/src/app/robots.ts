import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private/auth/API surfaces and the bare embed widget (its content is
        // already indexed via the club pages; the widget is noindex'd anyway).
        disallow: ['/api/', '/account', '/auth/', '/embed/', '/auction', '/auctions', '/captain/', '/bid/', '/live/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
