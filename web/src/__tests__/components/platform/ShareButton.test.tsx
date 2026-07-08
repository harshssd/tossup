import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShareButton } from '@/components/platform/ShareButton'

// ShareButton branches on browser capabilities (navigator.share, clipboard).
// jsdom provides none of these by default, so each test wires the exact
// capability it exercises and restores afterward.

// jsdom's default origin; every test passes an explicit `path`, so the
// pathname/search branch of absoluteUrl() is never exercised here.
const origin = 'http://localhost'

function stub(obj: object, key: string, value: unknown) {
  const had = Object.prototype.hasOwnProperty.call(obj, key)
  const prev = (obj as Record<string, unknown>)[key]
  Object.defineProperty(obj, key, { value, configurable: true, writable: true })
  return () => {
    if (had) Object.defineProperty(obj, key, { value: prev, configurable: true, writable: true })
    else delete (obj as Record<string, unknown>)[key]
  }
}

describe('ShareButton', () => {
  const restores: Array<() => void> = []

  afterEach(() => {
    while (restores.length) restores.pop()!()
    jest.clearAllMocks()
  })

  it('uses the Web Share API when available, with an absolute URL', async () => {
    const share = jest.fn().mockResolvedValue(undefined)
    restores.push(stub(navigator, 'share', share))

    render(<ShareButton title="Sidewinders CC" text="Sidewinders on TossUp" path="/club/sidewinders" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share).toHaveBeenCalledWith({
      title: 'Sidewinders CC',
      text: 'Sidewinders on TossUp',
      url: `${origin}/club/sidewinders`,
    })
  })

  it('swallows a dismissed share sheet without surfacing an error', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('Abort', 'AbortError'))
    restores.push(stub(navigator, 'share', share))

    render(<ShareButton title="X" path="/x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    // No throw, no "Link copied" state (share path returns before the fallback).
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByText(/link copied/i)).not.toBeInTheDocument()
  })

  it('falls back to clipboard and shows confirmation when Web Share is absent', async () => {
    restores.push(stub(navigator, 'share', undefined))
    const writeText = jest.fn().mockResolvedValue(undefined)
    restores.push(stub(navigator, 'clipboard', { writeText }))

    render(<ShareButton title="X" path="/club/x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(screen.getByText(/link copied/i)).toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith(`${origin}/club/x`)
  })

  it('prompts with the link when clipboard write is blocked', async () => {
    restores.push(stub(navigator, 'share', undefined))
    const writeText = jest.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    restores.push(stub(navigator, 'clipboard', { writeText }))
    const prompt = jest.fn()
    restores.push(stub(window, 'prompt', prompt))

    render(<ShareButton title="X" path="/club/x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() => expect(prompt).toHaveBeenCalledWith('Copy this link:', `${origin}/club/x`))
    expect(screen.queryByText(/link copied/i)).not.toBeInTheDocument()
  })

  it('opens a wa.me deep link with the encoded message and URL', () => {
    const open = jest.fn()
    restores.push(stub(window, 'open', open))

    render(<ShareButton title="X" text="Sidewinders on TossUp" path="/club/x" />)
    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }))

    expect(open).toHaveBeenCalledTimes(1)
    const url = open.mock.calls[0][0] as string
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    const decoded = decodeURIComponent(url.replace('https://wa.me/?text=', ''))
    expect(decoded).toBe(`Sidewinders on TossUp\n${origin}/club/x`)
  })

  it('renders the compact icon variant without the labelled pills', () => {
    render(<ShareButton title="X" path="/x" variant="icon" />)
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /whatsapp/i })).not.toBeInTheDocument()
  })
})
