import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// The landing page is a static server component wrapped in PlatformShell; the
// only client dependency is PlatformAuthNav, which subscribes to the PLATFORM
// Supabase project's auth state. Because jest.config has resetMocks: true, the
// mock client lives inside the factory and is re-wired in beforeEach.

jest.mock('@/lib/platform/auth-browser', () => {
  const mockPlatformClient = {
    auth: {
      onAuthStateChange: jest.fn(),
    },
  }
  return {
    createPlatformBrowserClient: jest.fn(() => mockPlatformClient),
    __mockPlatformClient: mockPlatformClient,
  }
})

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
  MockLink.displayName = 'MockLink'
  return MockLink
})

function getMockPlatformClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/platform/auth-browser').__mockPlatformClient
}

function getMockCreatePlatformBrowserClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/platform/auth-browser').createPlatformBrowserClient
}

import Home from '@/app/page'

describe('Home Page (platform landing)', () => {
  beforeEach(() => {
    // Re-wire mock implementations after resetMocks clears them: emit a
    // signed-out auth event synchronously, like supabase-js does on subscribe.
    const mockClient = getMockPlatformClient()
    getMockCreatePlatformBrowserClient().mockReturnValue(mockClient)
    mockClient.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: null) => void) => {
        cb('INITIAL_SESSION', null)
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      }
    )
  })

  describe('Brand and hero', () => {
    it('should render main brand elements', () => {
      render(<Home />)

      // Header and footer both carry the wordmark.
      expect(screen.getAllByText('TossUp').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/the home of grassroots cricket/i)).toBeInTheDocument()
    })

    it('should have a level-1 heading with the platform pitch', () => {
      render(<Home />)

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent(/find your club/i)
      expect(h1).toHaveTextContent(/host your/i)
    })
  })

  describe('Platform CTAs', () => {
    it('should point the primary CTAs at platform routes', () => {
      render(<Home />)

      expect(screen.getByRole('link', { name: /find your club/i })).toHaveAttribute('href', '/start')
      expect(screen.getAllByRole('link', { name: /host a tournament/i })[0]).toHaveAttribute(
        'href',
        '/tournaments/new'
      )
      expect(screen.getAllByRole('link', { name: /start a club/i })[0]).toHaveAttribute('href', '/club/new')
    })

    it('should link each pillar card to its platform flow', () => {
      render(<Home />)

      expect(screen.getByText('Host your league')).toBeInTheDocument()
      expect(screen.getByText('Grow your club')).toBeInTheDocument()
      expect(screen.getByText('Get discovered')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /discover cricket near you/i })).toHaveAttribute('href', '/discover')
    })

    it('should demote the auction to a footer tools link', () => {
      render(<Home />)

      const auctionLink = screen.getByRole('link', { name: /player auction/i })
      expect(auctionLink).toHaveAttribute('href', '/auctions')
      // No auction CTA anywhere above the footer.
      expect(screen.queryByRole('link', { name: /create auction/i })).not.toBeInTheDocument()
    })
  })

  describe('Platform auth state (PlatformAuthNav)', () => {
    it('should show the platform sign-in link when signed out', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/account/sign-in')
      })
      // The legacy auth routes must not appear on the landing page anymore.
      expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
    })

    it('should show the account avatar when a platform session exists', async () => {
      const mockClient = getMockPlatformClient()
      mockClient.auth.onAuthStateChange.mockImplementation(
        (cb: (event: string, session: unknown) => void) => {
          cb('SIGNED_IN', { user: { email: 'test@example.com', user_metadata: { name: 'Test User' } } })
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        }
      )

      render(<Home />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'TU' })).toHaveAttribute('href', '/account')
      })
      expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
    })

    it('should clean up the auth listener on unmount', async () => {
      const unsubscribe = jest.fn()
      const mockClient = getMockPlatformClient()
      mockClient.auth.onAuthStateChange.mockImplementation(
        (cb: (event: string, session: null) => void) => {
          cb('INITIAL_SESSION', null)
          return { data: { subscription: { unsubscribe } } }
        }
      )

      const { unmount } = render(<Home />)
      await waitFor(() => {
        expect(mockClient.auth.onAuthStateChange).toHaveBeenCalled()
      })

      unmount()
      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('Navigation', () => {
    it('should expose the platform nav links in the shell header', () => {
      render(<Home />)

      expect(screen.getByRole('link', { name: 'Clubs' })).toHaveAttribute('href', '/discover?tab=clubs')
      expect(screen.getAllByRole('link', { name: 'Tournaments' })[0]).toHaveAttribute('href', '/tournaments')
      expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/discover?tab=players')
    })
  })

  describe('Edge cases', () => {
    it('should render without crashing', () => {
      expect(() => render(<Home />)).not.toThrow()
    })
  })
})
