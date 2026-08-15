'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Clock, MapPin, Users, Check, HelpCircle, X } from 'lucide-react'
import type { EventType, RsvpStatus } from '@/lib/types'

interface EventCardProps {
  id: string
  title: string
  description?: string | null
  eventType: EventType
  location?: string | null
  startsAt: string
  endsAt?: string | null
  rsvpCounts: { going: number; maybe: number; notGoing: number }
  currentUserRsvp: RsvpStatus | null
  isAdmin: boolean
  onRsvp: (eventId: string, status: RsvpStatus) => void
  onEdit?: (eventId: string) => void
  onDelete?: (eventId: string) => void
}

const eventTypeColors: Record<EventType, string> = {
  PRACTICE: 'bg-green-500/10 text-green-400',
  MATCH: 'bg-blue-500/10 text-blue-400',
  SOCIAL: 'bg-purple-500/10 text-purple-400',
  OTHER: 'bg-gray-500/10 text-gray-400',
}

const eventTypeLabels: Record<EventType, string> = {
  PRACTICE: 'Practice',
  MATCH: 'Match',
  SOCIAL: 'Social',
  OTHER: 'Other',
}

export function EventCard({
  id,
  title,
  description,
  eventType,
  location,
  startsAt,
  endsAt,
  rsvpCounts,
  currentUserRsvp,
  isAdmin,
  onRsvp,
  onEdit,
  onDelete,
}: EventCardProps) {
  const startDate = new Date(startsAt)
  const isPast = startDate < new Date()

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card className={`border-white/[0.06] bg-white/[0.02] ${isPast ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-xs ${eventTypeColors[eventType]}`}>
                {eventTypeLabels[eventType]}
              </Badge>
              {isPast && (
                <Badge variant="secondary" className="text-xs">Past</Badge>
              )}
            </div>
            <h4 className="font-semibold text-foreground truncate">{title}</h4>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(startsAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(startsAt)}
                {endsAt && ` - ${formatTime(endsAt)}`}
              </span>
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {rsvpCounts.going} going
                {rsvpCounts.maybe > 0 && `, ${rsvpCounts.maybe} maybe`}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(id)} className="text-xs h-7 px-2">
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(id)} className="text-xs h-7 px-2 text-destructive">
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {/* RSVP buttons */}
        {!isPast && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground mr-1">RSVP:</span>
            <Button
              variant={currentUserRsvp === 'GOING' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onRsvp(id, 'GOING')}
            >
              <Check className="h-3 w-3" />
              Going
            </Button>
            <Button
              variant={currentUserRsvp === 'MAYBE' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onRsvp(id, 'MAYBE')}
            >
              <HelpCircle className="h-3 w-3" />
              Maybe
            </Button>
            <Button
              variant={currentUserRsvp === 'NOT_GOING' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onRsvp(id, 'NOT_GOING')}
            >
              <X className="h-3 w-3" />
              Can&apos;t Go
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
