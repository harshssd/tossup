-- Pavilion acknowledgements: let viewers confirm they've seen a critical
-- announcement, and let the host see a live count. The one thing a WhatsApp
-- group can't do.
--
-- Pre-auth identity is an anonymous per-browser viewer_id (localStorage UUID).
-- UNIQUE(post_id, viewer_id) stops one browser inflating the count. ack_count
-- is denormalized via trigger; the trigger UPDATEs the parent post, so the
-- count rides the existing league-filtered realtime posts stream — no new
-- broad subscription needed.

ALTER TABLE public.tournament_posts ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tournament_posts ADD COLUMN IF NOT EXISTS ack_count    INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tournament_post_acks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.tournament_posts(id) ON DELETE CASCADE,
  viewer_id   TEXT NOT NULL,
  viewer_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_post_acks_post   ON public.tournament_post_acks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_acks_viewer ON public.tournament_post_acks(viewer_id);

CREATE OR REPLACE FUNCTION public.bump_post_ack_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tournament_posts
       SET ack_count = ack_count + 1, updated_at = NOW()
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tournament_posts
       SET ack_count = GREATEST(ack_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_post_ack_count ON public.tournament_post_acks;
CREATE TRIGGER trg_post_ack_count
AFTER INSERT OR DELETE ON public.tournament_post_acks
FOR EACH ROW EXECUTE FUNCTION public.bump_post_ack_count();

-- RLS: read gated on the parent post's tournament being PUBLIC; anon
-- insert/delete (a viewer can acknowledge and un-acknowledge). No UPDATE path.
ALTER TABLE public.tournament_post_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_acks_public_read" ON public.tournament_post_acks;
CREATE POLICY "post_acks_public_read" ON public.tournament_post_acks
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournament_posts p
      JOIN public.leagues l ON l.id = p.league_id
     WHERE p.id = tournament_post_acks.post_id
       AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
  ));

DROP POLICY IF EXISTS "anon_write_ins" ON public.tournament_post_acks;
DROP POLICY IF EXISTS "anon_write_del" ON public.tournament_post_acks;
CREATE POLICY "anon_write_ins" ON public.tournament_post_acks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_write_del" ON public.tournament_post_acks FOR DELETE TO anon, authenticated USING (true);
