-- Club Events Schema
-- Adds club_events and event_rsvps tables for club event management

-- Create event type enum
CREATE TYPE event_type AS ENUM ('PRACTICE', 'MATCH', 'SOCIAL', 'OTHER');

-- Create RSVP status enum
CREATE TYPE rsvp_status AS ENUM ('GOING', 'NOT_GOING', 'MAYBE');

-- Club events table
CREATE TABLE public.club_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type event_type NOT NULL DEFAULT 'OTHER',
    location TEXT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event RSVPs table
CREATE TABLE public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.club_events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status rsvp_status NOT NULL DEFAULT 'GOING',
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX idx_club_events_club ON public.club_events(club_id);
CREATE INDEX idx_club_events_starts_at ON public.club_events(starts_at);
CREATE INDEX idx_club_events_created_by ON public.club_events(created_by);
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);

-- Updated_at trigger for club_events
CREATE TRIGGER handle_club_events_updated_at
    BEFORE UPDATE ON public.club_events
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for club_events

-- Club members can view events in their clubs
CREATE POLICY "Club members can view events" ON public.club_events
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_id = club_events.club_id AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_events.club_id AND owner_id = auth.uid()
    )
);

-- Club owners and admins can create events
CREATE POLICY "Club admins can create events" ON public.club_events
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_id = club_events.club_id AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_events.club_id AND owner_id = auth.uid()
    )
);

-- Club owners and admins can update events
CREATE POLICY "Club admins can update events" ON public.club_events
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_id = club_events.club_id AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_events.club_id AND owner_id = auth.uid()
    )
);

-- Club owners and admins can delete events
CREATE POLICY "Club admins can delete events" ON public.club_events
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_id = club_events.club_id AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_events.club_id AND owner_id = auth.uid()
    )
);

-- RLS Policies for event_rsvps

-- Members can view RSVPs for events they can see
CREATE POLICY "Members can view RSVPs" ON public.event_rsvps
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.club_events ce
        JOIN public.club_memberships cm ON cm.club_id = ce.club_id
        WHERE ce.id = event_rsvps.event_id AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.club_events ce
        JOIN public.clubs c ON c.id = ce.club_id
        WHERE ce.id = event_rsvps.event_id AND c.owner_id = auth.uid()
    )
);

-- Members can manage their own RSVP
CREATE POLICY "Members can manage own RSVP" ON public.event_rsvps
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.club_events ce
        JOIN public.club_memberships cm ON cm.club_id = ce.club_id
        WHERE ce.id = event_rsvps.event_id AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can update own RSVP" ON public.event_rsvps
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Members can delete own RSVP" ON public.event_rsvps
FOR DELETE USING (user_id = auth.uid());
