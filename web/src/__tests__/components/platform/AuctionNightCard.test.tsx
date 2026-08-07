import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Local next/link mock (uses this file's React import) — the card renders a Link.
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
  MockLink.displayName = 'MockLink'
  return MockLink
})

import { AuctionNightCard } from '@/components/platform/AuctionNightCard'

describe('AuctionNightCard', () => {
  it('promotes the auction as a premium module and hands off to the auction hub', () => {
    render(<AuctionNightCard />)
    expect(screen.getByRole('heading', { name: /player auction night/i })).toBeInTheDocument()
    expect(screen.getByText(/premium/i)).toBeInTheDocument()
    // Links to the auction product hub (not /auction/create, which needs a
    // legacy-DB league param a platform tournament can't supply).
    const cta = screen.getByRole('link', { name: /launch the auction tool/i })
    expect(cta).toHaveAttribute('href', '/auctions')
  })
})
