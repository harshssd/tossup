-- Phase 5: P7 (rename captain_id → captain_user_id) + P8 (drop team_members)

-- P7: Rename teams.captain_id column to captain_user_id for clarity
-- (captain_user_id = FK to users, captain_player_id = FK to players)
ALTER TABLE public.teams RENAME COLUMN captain_id TO captain_user_id;

-- Rename the FK constraint to match
ALTER TABLE public.teams RENAME CONSTRAINT teams_captain_id_fkey TO teams_captain_user_id_fkey;

-- Rename the index for clarity
ALTER INDEX IF EXISTS idx_teams_captain RENAME TO idx_teams_captain_user;

-- P8: Drop team_members table (replaced by auction_participations)
DROP TABLE IF EXISTS public.team_members;
