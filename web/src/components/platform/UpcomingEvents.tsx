'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EVENT_TYPE_LABEL, type EventWithCounts, type RsvpStatus } from '@/lib/platform/events'
import { clearRsvp, getMyRsvps, setRsvp } from '@/lib/platform/events-client'

const TYPE_DOT: Record<string, string> = {
  PRACTICE: '#1f9d57',
  MATCH: '#c99a1e',
  SOCIAL: '#2257b3',
  OTHER: '#6f6c63',
}

function whenLabel(startsAt: string, endsAt: string | null) {
  const s = new Date(startsAt)
  const start = s.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  if (!endsAt) return start
  const e = new Date(endsAt)
  const sameDay = s.toDateString() === e.toDateString()
  const end = e.toLocaleString(undefined, sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `${start} – ${end}`
}

/** Public upcoming-events list with an inline RSVP control. Signed-out users are
 *  routed to sign-in on their first RSVP. Renders nothing when there are no
 *  events (the caller shows the empty state). */
export function UpcomingEvents({ events }: { events: EventWithCounts[] }) {
  const router = useRouter()
  const [mine, setMine] = useState<Record<string, RsvpStatus>>({})
  const [going, setGoing] = useState<Record<string, number>>(
    Object.fromEntries(events.map((e) => [e.id, e.going]))
  )
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyRsvps(events.map((e) => e.id)).then((r) => {
      if (!cancelled) setMine(r)
    })
    return () => {
      cancelled = true
    }
  }, [events])

  if (events.length === 0) return null

  async function onRsvp(eventId: string, status: RsvpStatus) {
    if (pending) return
    const prev = mine[eventId]
    if (prev === status) return onClear(eventId, prev)
    // Optimistic: adjust the GOING tally for this event.
    setMine((m) => ({ ...m, [eventId]: status }))
    setGoing((g) => ({ ...g, [eventId]: (g[eventId] ?? 0) + (status === 'GOING' ? 1 : 0) - (prev === 'GOING' ? 1 : 0) }))
    setPending(eventId)
    try {
      await setRsvp(eventId, status)
    } catch (err) {
      // Revert, then route signed-out users to sign in.
      setMine((m) => ({ ...m, [eventId]: prev }))
      setGoing((g) => ({ ...g, [eventId]: (g[eventId] ?? 0) - (status === 'GOING' ? 1 : 0) + (prev === 'GOING' ? 1 : 0) }))
      const msg = (err as Error).message
      toast.error(msg)
      if (/sign in/i.test(msg)) router.push('/account/sign-in')
    } finally {
      setPending(null)
    }
  }

  async function onClear(eventId: string, prev: RsvpStatus | undefined) {
    if (pending) return
    setMine((m) => {
      const n = { ...m }
      delete n[eventId]
      return n
    })
    setGoing((g) => ({ ...g, [eventId]: (g[eventId] ?? 0) - (prev === 'GOING' ? 1 : 0) }))
    setPending(eventId)
    try {
      await clearRsvp(eventId)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mt-3 space-y-2.5">
      {events.map((e) => {
        const dot = TYPE_DOT[e.event_type] ?? TYPE_DOT.OTHER
        const my = mine[e.id]
        return (
          <div
            key={e.id}
            className="cy-panel overflow-hidden rounded-2xl border border-[#e7e4db] bg-white p-4"
            style={{ borderLeft: `4px solid ${dot}` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${dot}1a`, color: dot }}
                  >
                    {EVENT_TYPE_LABEL[e.event_type] ?? 'Event'}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#3a382f]">
                    <CalendarDays className="h-3.5 w-3.5" /> {whenLabel(e.starts_at, e.ends_at)}
                  </span>
                </div>
                <p className="mt-1.5 text-base font-semibold text-[#16150f]">{e.title}</p>
                {e.description && <p className="mt-1 text-sm leading-relaxed text-[#6f6c63]">{e.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[#6f6c63]">
                  {e.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {e.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {going[e.id] ?? 0} going
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant={my === 'GOING' ? 'default' : 'outline'}
                  disabled={pending === e.id}
                  className={my === 'GOING' ? 'bg-[#1f9d57] text-white hover:bg-[#0f5a30]' : ''}
                  onClick={() => onRsvp(e.id, 'GOING')}
                >
                  Going
                </Button>
                <Button
                  size="sm"
                  variant={my === 'MAYBE' ? 'default' : 'outline'}
                  disabled={pending === e.id}
                  className={my === 'MAYBE' ? 'bg-[#c99a1e] text-white hover:bg-[#a37f18]' : ''}
                  onClick={() => onRsvp(e.id, 'MAYBE')}
                >
                  Maybe
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
