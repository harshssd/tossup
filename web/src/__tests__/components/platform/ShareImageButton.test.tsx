import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShareImageButton } from '@/components/platform/ShareImageButton'

// ShareImageButton branches on navigator.canShare/share (file sharing) and falls
// back to window.open. jsdom provides none of these, so each test wires the exact
// capability it exercises and restores afterward.

function stub(obj: object, key: string, value: unknown) {
  const had = Object.prototype.hasOwnProperty.call(obj, key)
  const prev = (obj as Record<string, unknown>)[key]
  Object.defineProperty(obj, key, { value, configurable: true, writable: true })
  return () => {
    if (had) Object.defineProperty(obj, key, { value: prev, configurable: true, writable: true })
    else delete (obj as Record<string, unknown>)[key]
  }
}

const props = {
  imagePath: '/api/share/fixture/fx1',
  title: 'A vs B — result on TossUp',
  text: 'A 120/4 vs B 118/9 — A won by 2 runs',
  filename: 'a-vs-b-tossup',
}

describe('ShareImageButton', () => {
  const restores: Array<() => void> = []
  afterEach(() => {
    while (restores.length) restores.pop()!()
    jest.clearAllMocks()
  })

  it('shares the PNG as a file when the platform can share files', async () => {
    const canShare = jest.fn(() => true)
    const share = jest.fn().mockResolvedValue(undefined)
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    restores.push(stub(navigator, 'canShare', canShare))
    restores.push(stub(navigator, 'share', share))
    restores.push(stub(globalThis, 'fetch', fetchMock))

    render(<ShareImageButton {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /result card/i }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/share/fixture/fx1')
    const arg = share.mock.calls[0][0]
    expect(arg.files).toHaveLength(1)
    expect(arg.files[0].name).toBe('a-vs-b-tossup.png')
    expect(arg.title).toBe(props.title)
  })

  it('opens the image in a new tab when file sharing is unavailable', async () => {
    const open = jest.fn()
    restores.push(stub(window, 'open', open))
    // no navigator.canShare defined
    restores.push(stub(navigator, 'canShare', undefined))

    render(<ShareImageButton {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /result card/i }))

    await waitFor(() => expect(open).toHaveBeenCalledWith('http://localhost/api/share/fixture/fx1', '_blank', 'noopener,noreferrer'))
  })

  it('falls back to opening the image when the platform cannot share files', async () => {
    const canShare = jest.fn(() => false)
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    const open = jest.fn()
    restores.push(stub(navigator, 'canShare', canShare))
    restores.push(stub(globalThis, 'fetch', fetchMock))
    restores.push(stub(window, 'open', open))

    render(<ShareImageButton {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /result card/i }))

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(open).toHaveBeenCalledWith('http://localhost/api/share/fixture/fx1', '_blank', 'noopener,noreferrer')
  })
})
