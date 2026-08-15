-- 2026-08 audit fix PR 3 (U6/U7): connect the notification engine to the moments
-- users actually wait on, and make membership populate the follow graph.
--  1. Join request CREATED  → notify every club admin (they were never pinged).
--  2. Registration decided  → notify the registrant (approve AND reject paths).
--  3. Join approved         → the member auto-follows the club.
--  4. Registration approved → the registrant auto-follows the tournament.

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'CLUB_JOIN_REQUESTED';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'REG_APPROVED';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'REG_REJECTED';
