import { computeChecklist, checklistProgress } from '@/lib/platform/club-checklist'

const base = { hasCrest: false, hasDescription: false, memberCount: 0, eventCount: 0, announcementCount: 0, honorCount: 0 }

describe('computeChecklist', () => {
  it('starts all-undone for a fresh club (creator alone does not count as members)', () => {
    const items = computeChecklist({ ...base, memberCount: 1 })
    expect(items.every((i) => !i.done)).toBe(true)
    expect(items).toHaveLength(6)
  })

  it('marks items done from real signals', () => {
    const items = computeChecklist({
      hasCrest: true,
      hasDescription: true,
      memberCount: 5,
      eventCount: 1,
      announcementCount: 2,
      honorCount: 1,
    })
    expect(items.every((i) => i.done)).toBe(true)
  })

  it('every item carries a manage-page anchor', () => {
    for (const i of computeChecklist(base)) expect(i.anchor).toMatch(/^#[a-z]+$/)
  })
})

describe('checklistProgress', () => {
  it('counts and flags completion', () => {
    const items = computeChecklist({ ...base, hasCrest: true, eventCount: 1 })
    const p = checklistProgress(items)
    expect(p.done).toBe(2)
    expect(p.total).toBe(6)
    expect(p.complete).toBe(false)
    const all = computeChecklist({ hasCrest: true, hasDescription: true, memberCount: 2, eventCount: 1, announcementCount: 1, honorCount: 1 })
    expect(checklistProgress(all).complete).toBe(true)
  })
})
