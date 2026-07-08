import { onboardingProfileFields } from '@/lib/platform/onboarding'

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
