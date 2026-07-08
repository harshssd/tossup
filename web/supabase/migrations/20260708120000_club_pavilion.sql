-- Phase C4 (v1): club Pavilion — an admin announcements board. Generalizes the
-- tournament pavilion table with a club scope. Unlike the tournament board
-- (deferred-auth, anon-write), club posts are strictly authed: club admins write,
-- members + the public (PUBLIC clubs) read. Discussion/replies/flags for clubs
-- are a follow-up; v1 is announcements only.

ALTER TABLE public.tournament_posts ALTER COLUMN league_id DROP NOT NULL;
ALTER TABLE public.tournament_posts ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;
-- Exactly one scope. Existing rows (league_id set, club_id null) satisfy it.
DO $$ BEGIN
  ALTER TABLE public.tournament_posts
    ADD CONSTRAINT tournament_posts_one_scope CHECK ((league_id IS NOT NULL) <> (club_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_tournament_posts_club ON public.tournament_posts(club_id, created_at DESC);

-- Keep the deferred-auth anon writes for LEAGUE posts only; club posts must never
-- be anon-writable. Re-scope the blanket anon_write_* policies to club_id IS NULL.
DROP POLICY IF EXISTS "anon_write_ins" ON public.tournament_posts;
DROP POLICY IF EXISTS "anon_write_upd" ON public.tournament_posts;
DROP POLICY IF EXISTS "anon_write_del" ON public.tournament_posts;
CREATE POLICY "anon_write_ins" ON public.tournament_posts FOR INSERT TO anon, authenticated WITH CHECK (club_id IS NULL);
CREATE POLICY "anon_write_upd" ON public.tournament_posts FOR UPDATE TO anon, authenticated USING (club_id IS NULL) WITH CHECK (club_id IS NULL);
CREATE POLICY "anon_write_del" ON public.tournament_posts FOR DELETE TO anon, authenticated USING (club_id IS NULL);

-- Replies stay league-only for now (no club replies in v1). Prevent anon (or
-- anyone) from attaching a reply to a club post.
DROP POLICY IF EXISTS "anon_write_ins" ON public.tournament_post_replies;
DROP POLICY IF EXISTS "anon_write_upd" ON public.tournament_post_replies;
DROP POLICY IF EXISTS "anon_write_del" ON public.tournament_post_replies;
CREATE POLICY "anon_write_ins" ON public.tournament_post_replies FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tournament_posts p WHERE p.id = post_id AND p.club_id IS NULL));
CREATE POLICY "anon_write_upd" ON public.tournament_post_replies FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_posts p WHERE p.id = post_id AND p.club_id IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tournament_posts p WHERE p.id = post_id AND p.club_id IS NULL));
CREATE POLICY "anon_write_del" ON public.tournament_post_replies FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tournament_posts p WHERE p.id = post_id AND p.club_id IS NULL));

-- Club post reads: public for PUBLIC clubs; members + admins for their own (incl. PRIVATE).
CREATE POLICY "posts_club_public_read" ON public.tournament_posts
  FOR SELECT TO anon, authenticated
  USING (club_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = tournament_posts.club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
  ));
CREATE POLICY "posts_club_member_read" ON public.tournament_posts
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL
    AND (is_scope_admin(auth.uid(), 'club', club_id) OR is_club_member(auth.uid(), club_id)));

-- Club post writes: club admins only (v1 = announcements board). author_id pinned.
CREATE POLICY "posts_club_admin_ins" ON public.tournament_posts
  FOR INSERT TO authenticated
  WITH CHECK (club_id IS NOT NULL AND is_scope_admin(auth.uid(), 'club', club_id) AND author_id = auth.uid());
CREATE POLICY "posts_club_admin_upd" ON public.tournament_posts
  FOR UPDATE TO authenticated
  USING (club_id IS NOT NULL AND is_scope_admin(auth.uid(), 'club', club_id))
  WITH CHECK (club_id IS NOT NULL AND is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "posts_club_admin_del" ON public.tournament_posts
  FOR DELETE TO authenticated
  USING (club_id IS NOT NULL AND is_scope_admin(auth.uid(), 'club', club_id));
