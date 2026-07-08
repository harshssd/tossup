import type { PlayerProfile } from './queries'

/** The subset of player_profiles a user may set about themselves. Deliberately
 *  excludes the trust/recognition columns (recognition_tier, reputation_score,
 *  merged_into_id) — those are system-owned and additionally guarded by a DB
 *  trigger (see 20260708150000_guard_profile_trust_and_self_person.sql). */
export type ProfileEditableFields = Partial<
  Pick<
    PlayerProfile,
    'display_name' | 'bio' | 'city' | 'region' | 'country' | 'primary_role' | 'availability' | 'looking_for_club' | 'visibility'
  >
>

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
export function onboardingProfileFields(i: OnboardingInput): ProfileEditableFields {
  return {
    city: i.city.trim() || null,
    region: i.region.trim() || null,
    country: i.country || null,
    primary_role: i.role || null,
    availability: i.availability.trim() || null,
    looking_for_club: true,
  }
}

/** True when the user gave us enough location to match clubs (city or state).
 *  Guards the wizard from persisting a location-less "looking for club" profile
 *  and fetching every recruiting club. Pure — unit-tested. */
export function hasLocatableInput(i: { city: string; region: string }): boolean {
  return i.city.trim().length > 0 || i.region.trim().length > 0
}
