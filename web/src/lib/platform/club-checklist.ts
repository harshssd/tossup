// Club activation checklist (2026-08 "good to great"): the guided path from
// "created a club" to "club that looks alive". Pure compute — unit-tested; the
// component supplies live counts.

export interface ChecklistInput {
  hasCrest: boolean
  hasDescription: boolean
  memberCount: number
  eventCount: number
  announcementCount: number
  honorCount: number
}

export interface ChecklistItem {
  key: string
  label: string
  done: boolean
  /** Anchor on the manage page for the section that completes this item. */
  anchor: string
}

/** The setup steps, in the order a new organizer should take them. */
export function computeChecklist(i: ChecklistInput): ChecklistItem[] {
  return [
    { key: 'crest', label: 'Upload your crest', done: i.hasCrest, anchor: '#branding' },
    { key: 'description', label: 'Write a short description', done: i.hasDescription, anchor: '#settings' },
    { key: 'members', label: 'Add your first members', done: i.memberCount >= 2, anchor: '#members' },
    { key: 'event', label: 'Schedule your first practice or match', done: i.eventCount >= 1, anchor: '#events' },
    { key: 'announcement', label: 'Post your first announcement', done: i.announcementCount >= 1, anchor: '#announcements' },
    { key: 'honor', label: 'Add a trophy to your cabinet', done: i.honorCount >= 1, anchor: '#honours' },
  ]
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number; complete: boolean } {
  const done = items.filter((x) => x.done).length
  return { done, total: items.length, complete: done === items.length }
}
