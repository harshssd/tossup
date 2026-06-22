-- The Pavilion: a structured communications hub for tournament hosts.
-- Replaces ad-hoc WhatsApp groups with a ranked board attached to each tournament:
--   * Announcements (host -> everyone): pinned + relevance-ranked
--   * Flags         (anyone -> host):   issue/dispute lifecycle (OPEN/ACK/RESOLVED)
--   * Discussion    (anyone):           generic threads with replies
-- Pre-auth: anon read of PUBLIC-tournament posts, anon writes (author_id/is_host
-- are auth-ready but not yet enforced — consistent with the rest of the platform).

-- ---------------------------------------------------------------------------
-- Enums (CREATE TYPE has no IF NOT EXISTS — guard for idempotent re-runs).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.post_kind AS ENUM ('ANNOUNCEMENT','SCHEDULE','RESULT','ALERT','GENERAL','FLAG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.post_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flag_status AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Posts: one row per announcement / flag / discussion thread root.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  kind         public.post_kind NOT NULL DEFAULT 'ANNOUNCEMENT',
  priority     public.post_priority NOT NULL DEFAULT 'NORMAL',
  title        TEXT,
  body         TEXT NOT NULL,
  author_name  TEXT,
  author_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_host      BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at    TIMESTAMPTZ,
  status       public.flag_status,        -- only meaningful when kind = 'FLAG'
  expires_at   TIMESTAMPTZ,               -- optional auto-expiry for time-bound notices
  reply_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_posts_league ON public.tournament_posts(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_posts_kind   ON public.tournament_posts(league_id, kind);

-- ---------------------------------------------------------------------------
-- Replies: single-level threads under a post (discussion + host responses).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_post_replies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES public.tournament_posts(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  author_name  TEXT,
  author_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_host      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_replies_post ON public.tournament_post_replies(post_id, created_at);

-- ---------------------------------------------------------------------------
-- Keep reply_count accurate via trigger (avoids app-side races).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_post_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournament_posts
       SET reply_count = reply_count + 1, updated_at = NOW()
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournament_posts
       SET reply_count = GREATEST(reply_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_post_reply_count ON public.tournament_post_replies;
CREATE TRIGGER trg_post_reply_count
AFTER INSERT OR DELETE ON public.tournament_post_replies
FOR EACH ROW EXECUTE FUNCTION public.bump_post_reply_count();

-- ---------------------------------------------------------------------------
-- RLS. SELECT is gated on the parent tournament being PUBLIC (so a PRIVATE
-- tournament's board never leaks). Writes are anon-permitted until auth lands,
-- declared per-command (NOT a permissive FOR ALL) so SELECT stays governed
-- solely by the read policy — see 20260621010000 for why that matters.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournament_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_post_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_posts_public_read" ON public.tournament_posts;
CREATE POLICY "tournament_posts_public_read" ON public.tournament_posts
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leagues l
     WHERE l.id = tournament_posts.league_id
       AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
  ));

DROP POLICY IF EXISTS "post_replies_public_read" ON public.tournament_post_replies;
CREATE POLICY "post_replies_public_read" ON public.tournament_post_replies
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_posts p
      JOIN public.leagues l ON l.id = p.league_id
     WHERE p.id = tournament_post_replies.post_id
       AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
  ));

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['tournament_posts','tournament_post_replies'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_ins" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_upd" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_del" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "anon_write_ins" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_upd" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_del" ON public.%I FOR DELETE TO anon, authenticated USING (true);', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Realtime: stream new posts/replies to open boards (guard double-add).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_post_replies;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
