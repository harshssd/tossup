-- Notifications Schema
-- In-app notification inbox for users

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
    'EVENT_REMINDER',
    'EVENT_CREATED',
    'MEMBER_JOINED',
    'TOURNAMENT_REGISTRATION',
    'TOURNAMENT_UPDATE',
    'CLUB_INVITE',
    'GENERAL'
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type notification_type NOT NULL DEFAULT 'GENERAL',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only read their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

-- System/server can insert notifications (via service role key)
-- No INSERT policy needed for regular users - notifications are created server-side
