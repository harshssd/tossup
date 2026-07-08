import type { PlayerProfile } from './queries'

export interface OnboardingInput {
  city: string
  region: string
  country: string
  role: string
  availability: string
}

/** Map the onboarding wizard's form to the player_profiles fields to persist.
 *  Trims + null-coerces blanks and always flags the profile "looking for a club",
 *  so clubs recruiting nearby surface it on the recruiting board. Pure — unit-tested. */
export function onboardingProfileFields(i: OnboardingInput): Partial<PlayerProfile> {
  return {
    city: i.city.trim() || null,
    region: i.region.trim() || null,
    country: i.country || null,
    primary_role: i.role || null,
    availability: i.availability.trim() || null,
    looking_for_club: true,
  }
}
