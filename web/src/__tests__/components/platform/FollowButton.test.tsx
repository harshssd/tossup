import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FollowButton } from '@/components/platform/FollowButton'

// Capture router.push and the setFollow mutation to assert the optimistic +
// signed-out flows without a network.
const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const setFollow = jest.fn()
jest.mock('@/lib/platform/follows-client', () => ({ setFollow: (...a: unknown[]) => setFollow(...a) }))

beforeEach(() => {
  push.mockReset()
  setFollow.mockReset().mockResolvedValue(true)
})

function renderBtn(over: Partial<React.ComponentProps<typeof FollowButton>> = {}) {
  return render(
    <FollowButton
      scope="club"
      scopeId="club1"
      signedIn
      following={false}
      followerCount={3}
      redirectPath="/club/sidewinders"
      {...over}
    />
  )
}

describe('FollowButton', () => {
  it('renders Follow with the follower count when not yet following', () => {
    renderBtn()
    expect(screen.getByRole('button', { name: /follow/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('3 followers')).toBeInTheDocument()
  })

  it('renders Following state when already followed', () => {
    renderBtn({ following: true, followerCount: 1 })
    const btn = screen.getByRole('button', { name: /following/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 follower')).toBeInTheDocument()
  })

  it('optimistically flips to Following and bumps the count on click', async () => {
    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /follow/i }))
    // Optimistic update is synchronous.
    expect(screen.getByRole('button', { name: /following/i })).toBeInTheDocument()
    expect(screen.getByText('4 followers')).toBeInTheDocument()
    await waitFor(() => expect(setFollow).toHaveBeenCalledWith('club', 'club1', true))
  })

  it('reverts the optimistic state when the mutation fails', async () => {
    setFollow.mockRejectedValue(new Error('network'))
    renderBtn()
    fireEvent.click(screen.getByRole('button', { name: /follow/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /follow/i })).toHaveAttribute('aria-pressed', 'false'))
    expect(screen.getByText('3 followers')).toBeInTheDocument()
  })

  it('routes a signed-out visitor to sign-in with a redirect, without mutating', () => {
    renderBtn({ signedIn: false })
    fireEvent.click(screen.getByRole('button', { name: /follow/i }))
    expect(push).toHaveBeenCalledWith('/account/sign-in?redirect=%2Fclub%2Fsidewinders')
    expect(setFollow).not.toHaveBeenCalled()
  })
})
