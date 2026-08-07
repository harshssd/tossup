-- Phase E3: follows — a lightweight subscribe so a signed-in user can follow a
-- PUBLIC club or tournament and get a personal /home feed of their events,
-- results, and announcements. This is the retention layer; the email digest
-- (later) hangs off the same table. Deliberately minimal: one row per
-- (user, scope, target), no notification fan-out yet.

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,   -- the follower (auth user)
  scope text NOT NULL CHECK (scope IN ('club', 'league')),               -- what kind of thing is followed
  scope_id uuid NOT NULL,                                                 -- clubs.id or leagues.id
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, scope_id)
);

-- Feed builder reads all of a viewer's follows newest-first.
CREATE INDEX IF NOT EXISTS idx_follows_user ON public.follows (user_id, created_at DESC);
-- follower_count() counts by target.
CREATE INDEX IF NOT EXISTS idx_follows_target ON public.follows (scope, scope_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_self_read ON public.follows;
DROP POLICY IF EXISTS follows_self_insert ON public.follows;
DROP POLICY IF EXISTS follows_self_delete ON public.follows;

-- A follow is a private signal: a user reads only their own follows. Aggregate
-- "N followers" is exposed via the definer function below, never row-by-row, so
-- one user can't enumerate who follows a club.
CREATE POLICY follows_self_read ON public.follows
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Insert your own follow, and only to a target you can actually see (a PUBLIC
-- club / league). Mirrors the visibility gate on club_join_requests — you can't
-- follow (and thereby pull content from) a PRIVATE scope you couldn't otherwise
-- read.
CREATE POLICY follows_self_insert ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (scope = 'club' AND EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = scope_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
      ))
      OR
      (scope = 'league' AND EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = scope_id AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
      ))
    )
  );

-- Unfollow: remove your own row.
CREATE POLICY follows_self_delete ON public.follows
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- No UPDATE policy: a follow has no mutable fields; you follow or unfollow.

-- Public follower count for a target. SECURITY DEFINER so it can aggregate across
-- the whole table (which is otherwise own-rows-only) WITHOUT exposing who — it
-- returns just an integer. Callable by anyone (a signed-out visitor sees the
-- count on a club/tournament hero). Gated on the target being PUBLIC so it can't
-- confirm the existence of / leak metadata about a PRIVATE scope to a caller who
-- happens to hold its UUID — matching the follow/feed visibility invariant. A
-- non-public (or unknown) target returns 0.
CREATE OR REPLACE FUNCTION public.follower_count(p_scope text, p_scope_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT count(*) FROM public.follows f
  WHERE f.scope = p_scope AND f.scope_id = p_scope_id
    AND (
      (p_scope = 'club' AND EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = p_scope_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
      ))
      OR
      (p_scope = 'league' AND EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = p_scope_id AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
      ))
    );
$$;

REVOKE EXECUTE ON FUNCTION public.follower_count(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.follower_count(text, uuid) TO anon, authenticated;
