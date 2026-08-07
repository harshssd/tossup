import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Local next/link mock (uses this file's React import) — the card renders a Link.
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

import { AuctionNightCard } from '@/components/platform/AuctionNightCard'

describe('AuctionNightCard', () => {
  it('frames the auction as an add-on and hands off (new tab) to the auction hub', () => {
    render(<AuctionNightCard />)
    expect(screen.getByRole('heading', { name: /player auction night/i })).toBeInTheDocument()
    expect(screen.getByText(/add-on/i)).toBeInTheDocument()
    // Links to the auction product hub (not /auction/create, which needs a
    // legacy-DB league param a platform tournament can't supply), in a new tab.
    const cta = screen.getByRole('link', { name: /open the auction tool/i })
    expect(cta).toHaveAttribute('href', '/auctions')
    expect(cta).toHaveAttribute('target', '_blank')
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
