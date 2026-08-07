import { clubEmbedPath, clubEmbedSnippet } from '@/lib/platform/embed'

describe('clubEmbedPath', () => {
  it('points at the embed route with the slug encoded', () => {
    expect(clubEmbedPath('sidewinders')).toBe('/embed/club/sidewinders')
    expect(clubEmbedPath('a b/c')).toBe('/embed/club/a%20b%2Fc')
  })
})

describe('clubEmbedSnippet', () => {
  it('builds an iframe pointing at the absolute embed URL', () => {
    const html = clubEmbedSnippet('https://tossup.app', 'sidewinders')
    expect(html).toContain('src="https://tossup.app/embed/club/sidewinders"')
    expect(html).toContain('<iframe')
    expect(html).toContain('title="Club on TossUp"')
    expect(html).toContain('loading="lazy"')
  })

  it('normalises a trailing slash on the origin', () => {
    expect(clubEmbedSnippet('https://tossup.app/', 'x')).toContain('src="https://tossup.app/embed/club/x"')
  })

  it('encodes the slug in the src', () => {
    expect(clubEmbedSnippet('https://tossup.app', 'a b')).toContain('/embed/club/a%20b"')
  })
})
