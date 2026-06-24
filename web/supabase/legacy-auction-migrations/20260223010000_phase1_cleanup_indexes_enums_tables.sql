-- Phase 1: Pure DB cleanup — redundant indexes, unused enum values, dead tables

-- P6: Drop 5 redundant indexes (duplicates of unique constraint implicit indexes)
DROP INDEX IF EXISTS idx_auction_bids_team;
DROP INDEX IF EXISTS idx_club_invites_token;
DROP INDEX IF EXISTS idx_league_invites_token;
DROP INDEX IF EXISTS idx_clubs_slug;
DROP INDEX IF EXISTS idx_live_auctions_id;

-- P5: Clean up league_type enum — remove SEASONAL, CHAMPIONSHIP
ALTER TABLE leagues ALTER COLUMN type DROP DEFAULT;
ALTER TYPE league_type RENAME TO league_type_old;
CREATE TYPE league_type AS ENUM ('TOURNAMENT', 'LEAGUE');
ALTER TABLE leagues ALTER COLUMN type TYPE league_type USING type::text::league_type;
ALTER TABLE leagues ALTER COLUMN type SET DEFAULT 'TOURNAMENT';
DROP TYPE league_type_old;

-- P5: Clean up organization_role enum — remove ADMIN, MODERATOR
ALTER TABLE league_memberships ALTER COLUMN role DROP DEFAULT;
ALTER TABLE club_memberships ALTER COLUMN role DROP DEFAULT;
ALTER TABLE league_invites ALTER COLUMN role DROP DEFAULT;
ALTER TABLE club_invites ALTER COLUMN role DROP DEFAULT;
ALTER TYPE organization_role RENAME TO organization_role_old;
CREATE TYPE organization_role AS ENUM ('OWNER', 'MEMBER');
ALTER TABLE league_memberships ALTER COLUMN role TYPE organization_role USING role::text::organization_role;
ALTER TABLE club_memberships ALTER COLUMN role TYPE organization_role USING role::text::organization_role;
ALTER TABLE league_invites ALTER COLUMN role TYPE organization_role USING role::text::organization_role;
ALTER TABLE club_invites ALTER COLUMN role TYPE organization_role USING role::text::organization_role;
ALTER TABLE league_memberships ALTER COLUMN role SET DEFAULT 'MEMBER';
ALTER TABLE club_memberships ALTER COLUMN role SET DEFAULT 'MEMBER';
ALTER TABLE league_invites ALTER COLUMN role SET DEFAULT 'MEMBER';
ALTER TABLE club_invites ALTER COLUMN role SET DEFAULT 'MEMBER';
DROP TYPE organization_role_old;

-- P9 (partial): Drop dry_runs table (0 rows, no write endpoints)
DROP TABLE IF EXISTS dry_runs;
