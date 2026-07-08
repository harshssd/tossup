import { onboardingProfileFields, hasLocatableInput } from '@/lib/platform/onboarding'

describe('onboardingProfileFields', () => {
  it('trims, null-coerces blanks, and always flags looking_for_club', () => {
    expect(
      onboardingProfileFields({ city: '  San Jose ', region: ' California ', country: 'US', role: 'BOWLER', availability: '  Weekends ' })
    ).toEqual({
      city: 'San Jose',
      region: 'California',
      country: 'US',
      primary_role: 'BOWLER',
      availability: 'Weekends',
      looking_for_club: true,
    })
  })

  it('sends null for empty optional fields but still marks looking_for_club', () => {
    expect(onboardingProfileFields({ city: '', region: '   ', country: '', role: '', availability: '' })).toEqual({
      city: null,
      region: null,
      country: null,
      primary_role: null,
      availability: null,
      looking_for_club: true,
    })
  })
})

describe('hasLocatableInput', () => {
  it('is true when either city or state has content', () => {
    expect(hasLocatableInput({ city: 'San Jose', region: '' })).toBe(true)
    expect(hasLocatableInput({ city: '', region: 'California' })).toBe(true)
    expect(hasLocatableInput({ city: 'San Jose', region: 'California' })).toBe(true)
  })

  it('is false when both are blank or whitespace-only', () => {
    expect(hasLocatableInput({ city: '', region: '' })).toBe(false)
    expect(hasLocatableInput({ city: '   ', region: '\t' })).toBe(false)
  })
})
