-- Phase 2 (identity model): per-scope memberships, standing teams, the
-- scope-admin helper, and the "admins must be users" enforcement.
--
-- Memberships are per-scope tables keyed on Person (player_profiles), each
-- UNIQUE per (person, scope). The empty user-keyed club/league membership
-- tables on this project are replaced (0 rows; legacy auction app uses its own
-- separate Supabase project, unaffected).

-- ---------------------------------------------------------------------------
-- Standing club team. The mobile practice_teams folds into this in Phase 3.
-- (Legacy auction `teams` lives in a different project — no collision here.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, name)
);
CREATE INDEX IF NOT EXISTS idx_teams_club ON public.teams(club_id);

-- A tournament team may optionally be a standing club team registered into the
-- tournament (roster pre-fills); null => ad-hoc team.
ALTER TABLE public.tournament_teams
  ADD COLUMN IF NOT EXISTS club_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Per-scope memberships (Person <-> scope, with a role). UNIQUE per scope.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.club_memberships CASCADE;
DROP TABLE IF EXISTS public.league_memberships CASCADE;

CREATE TABLE public.club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  club_id   UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, club_id)
);
CREATE TABLE public.team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, team_id)
);
CREATE TABLE public.league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, league_id)
);
CREATE TABLE public.tournament_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  tournament_team_id UUID NOT NULL REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, tournament_team_id)
);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club   ON public.club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_person ON public.club_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team   ON public.team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_person ON public.team_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_league ON public.league_memberships(league_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_person ON public.league_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_ttm_team   ON public.tournament_team_memberships(tournament_team_id);
CREATE INDEX IF NOT EXISTS idx_ttm_person ON public.tournament_team_memberships(person_id);

-- ---------------------------------------------------------------------------
-- Scope-admin check. SECURITY DEFINER so Phase 4 RLS policies can call it
-- WITHOUT recursively evaluating membership-table RLS (the recursion footgun).
-- Direct scope only (no cross-scope inheritance yet). owner_id columns on
-- clubs/leagues reference users(id).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_scope_admin(p_user UUID, p_scope TEXT, p_scope_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ok BOOLEAN := FALSE;
BEGIN
  IF p_user IS NULL OR p_scope_id IS NULL THEN RETURN FALSE; END IF;
  IF p_scope = 'club' THEN
    SELECT EXISTS(SELECT 1 FROM clubs c WHERE c.id = p_scope_id AND c.owner_id = p_user)
        OR EXISTS(SELECT 1 FROM club_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.club_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  ELSIF p_scope = 'league' THEN
    SELECT EXISTS(SELECT 1 FROM leagues l WHERE l.id = p_scope_id AND l.owner_id = p_user)
        OR EXISTS(SELECT 1 FROM league_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.league_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  ELSIF p_scope = 'team' THEN
    SELECT EXISTS(SELECT 1 FROM team_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.team_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  ELSIF p_scope = 'tournament_team' THEN
    SELECT EXISTS(SELECT 1 FROM tournament_team_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.tournament_team_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  END IF;
  RETURN COALESCE(ok, FALSE);
END $$;

-- ---------------------------------------------------------------------------
-- "Admins must be logged-in users", enforced on BOTH sides:
--  (a) an OWNER/ADMIN membership requires the Person to be user-linked;
--  (b) a Person can't be unlinked while it still holds an admin/owner role.
-- FOR UPDATE on the person row serializes concurrent link/unlink vs role grant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_admin_is_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE linked BOOLEAN;
BEGIN
  IF NEW.role IN ('OWNER','ADMIN') THEN
    SELECT (user_id IS NOT NULL) INTO linked FROM player_profiles WHERE id = NEW.person_id FOR UPDATE;
    IF NOT COALESCE(linked, FALSE) THEN
      RAISE EXCEPTION 'Admin/owner membership requires the person to be linked to a user account (person %)', NEW.person_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['club_memberships','team_memberships','league_memberships','tournament_team_memberships'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_admin_is_user ON public.%I;', t);
    EXECUTE format('CREATE TRIGGER trg_admin_is_user BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_is_user();', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.block_unlink_with_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE held INT;
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT count(*) INTO held FROM (
      SELECT 1 FROM club_memberships            WHERE person_id = OLD.id AND role IN ('OWNER','ADMIN')
      UNION ALL SELECT 1 FROM team_memberships  WHERE person_id = OLD.id AND role IN ('OWNER','ADMIN')
      UNION ALL SELECT 1 FROM league_memberships WHERE person_id = OLD.id AND role IN ('OWNER','ADMIN')
      UNION ALL SELECT 1 FROM tournament_team_memberships WHERE person_id = OLD.id AND role IN ('OWNER','ADMIN')
    ) x;
    IF held > 0 THEN
      RAISE EXCEPTION 'Cannot unlink: person % holds admin/owner roles — demote or reassign first', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_block_unlink_admin ON public.player_profiles;
CREATE TRIGGER trg_block_unlink_admin BEFORE UPDATE OF user_id ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_unlink_with_admin_role();

-- ---------------------------------------------------------------------------
-- RLS: additive pre-auth posture — public read + per-command anon writes (never
-- a permissive FOR ALL). Phase 4 scopes writes to is_scope_admin(); the
-- admin-is-user invariant is already enforced by trigger regardless of RLS.
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['teams','club_memberships','team_memberships','league_memberships','tournament_team_memberships'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "public_read" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "public_read" ON public.%I FOR SELECT TO anon, authenticated USING (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_ins" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_upd" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_del" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "anon_write_ins" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_upd" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_del" ON public.%I FOR DELETE TO anon, authenticated USING (true);', t);
  END LOOP;
END $$;
