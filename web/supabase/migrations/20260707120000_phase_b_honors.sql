-- Phase B — Honors board (trophy cabinet).
--
-- The differentiator for club adoption: a club's silverware — which cup, which
-- year, under whose captaincy, and who played — without managing scorecards.
-- Honors live in a club's cabinet (club_id). Captain and squad are Persons
-- (player_profiles), so account-less legends count and merge/link keeps the
-- history intact. `source` distinguishes a club's self-reported honor from a
-- TOSSUP_VERIFIED one written when a tournament hosted here is concluded (that
-- writer lands in a later migration; the column + check exist now).

-- ---------- honors ----------
CREATE TABLE public.honors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  title text NOT NULL,
  result text NOT NULL DEFAULT 'CHAMPION'
    CHECK (result IN ('CHAMPION','RUNNER_UP','THIRD','SPECIAL')),
  year int CHECK (year IS NULL OR (year BETWEEN 1850 AND 2100)),
  season_label text,
  captain_person_id uuid REFERENCES public.player_profiles(id) ON DELETE SET NULL,
  notes text,
  photo_url text,
  source text NOT NULL DEFAULT 'SELF_REPORTED'
    CHECK (source IN ('SELF_REPORTED','TOSSUP_VERIFIED')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX honors_club_year_idx ON public.honors (club_id, year DESC NULLS LAST);
CREATE INDEX honors_captain_idx ON public.honors (captain_person_id);
CREATE INDEX honors_league_idx ON public.honors (league_id);

-- ---------- honor_squad_members ("who all played") ----------
CREATE TABLE public.honor_squad_members (
  honor_id uuid NOT NULL REFERENCES public.honors(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  role_label text,
  PRIMARY KEY (honor_id, person_id)
);
CREATE INDEX honor_squad_person_idx ON public.honor_squad_members (person_id);

-- ---------- RLS: public read when the club is public; admin writes ----------
ALTER TABLE public.honors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "honors_public_read" ON public.honors
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c
                 WHERE c.id = club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)));
CREATE POLICY "honors_admin_read" ON public.honors
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "honors_admin_insert" ON public.honors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "honors_admin_update" ON public.honors
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', club_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "honors_admin_delete" ON public.honors
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', club_id));

ALTER TABLE public.honor_squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hsquad_public_read" ON public.honor_squad_members
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.honors h JOIN public.clubs c ON c.id = h.club_id
                 WHERE h.id = honor_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)));
CREATE POLICY "hsquad_admin_read" ON public.honor_squad_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.honors h
                 WHERE h.id = honor_id AND public.is_scope_admin(auth.uid(), 'club', h.club_id)));
CREATE POLICY "hsquad_admin_insert" ON public.honor_squad_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.honors h
                      WHERE h.id = honor_id AND public.is_scope_admin(auth.uid(), 'club', h.club_id)));
CREATE POLICY "hsquad_admin_delete" ON public.honor_squad_members
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.honors h
                 WHERE h.id = honor_id AND public.is_scope_admin(auth.uid(), 'club', h.club_id)));

-- ---------- create_honor (atomic honor + squad, admin-checked) ----------
-- SECURITY DEFINER so honor + squad rows commit in one txn; self-checks
-- club-admin authority (null auth.uid() = trusted server, but is_scope_admin
-- returns false for a null user so the client must be authed). Captain and
-- squad must belong to the club's roster; stray squad ids are skipped, not
-- errored, so one bad id doesn't lose the whole honor.
CREATE OR REPLACE FUNCTION public.create_honor(
  p_club_id uuid,
  p_title text,
  p_result text DEFAULT 'CHAMPION',
  p_year int DEFAULT NULL,
  p_season_label text DEFAULT NULL,
  p_captain_person_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_squad uuid[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_person uuid;
BEGIN
  IF NOT public.is_scope_admin(auth.uid(), 'club', p_club_id) THEN
    RAISE EXCEPTION 'only a club admin can add honors';
  END IF;
  IF coalesce(btrim(p_title), '') = '' THEN
    RAISE EXCEPTION 'honor title is required';
  END IF;
  IF p_result NOT IN ('CHAMPION','RUNNER_UP','THIRD','SPECIAL') THEN
    RAISE EXCEPTION 'invalid result';
  END IF;
  IF p_captain_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM club_memberships m WHERE m.club_id = p_club_id AND m.person_id = p_captain_person_id
  ) THEN
    RAISE EXCEPTION 'captain must be a club member';
  END IF;

  INSERT INTO honors (club_id, title, result, year, season_label,
                      captain_person_id, notes, photo_url, source, created_by)
  VALUES (p_club_id, btrim(p_title), p_result, p_year, nullif(btrim(p_season_label), ''),
          p_captain_person_id, nullif(btrim(p_notes), ''), nullif(btrim(p_photo_url), ''),
          'SELF_REPORTED', auth.uid())
  RETURNING id INTO v_id;

  IF p_squad IS NOT NULL THEN
    FOREACH v_person IN ARRAY p_squad LOOP
      IF EXISTS (SELECT 1 FROM club_memberships m WHERE m.club_id = p_club_id AND m.person_id = v_person) THEN
        INSERT INTO honor_squad_members (honor_id, person_id) VALUES (v_id, v_person)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_honor(uuid, text, text, int, text, uuid, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_honor(uuid, text, text, int, text, uuid, text, text, uuid[]) TO authenticated;
