-- Simplify league_type enum: remove SEASONAL and CHAMPIONSHIP values
-- Only TOURNAMENT and LEAGUE are used in the create flow

-- Step 1: Update any rows using removed values to TOURNAMENT
UPDATE leagues SET type = 'TOURNAMENT' WHERE type IN ('SEASONAL', 'CHAMPIONSHIP');

-- Step 2: Remove the status column (not backed by DB enum, unused)
ALTER TABLE leagues DROP COLUMN IF EXISTS status;

-- Step 3: Recreate the enum with only the two used values
ALTER TABLE leagues ALTER COLUMN type DROP DEFAULT;
ALTER TABLE leagues ALTER COLUMN type TYPE text;
DROP TYPE IF EXISTS league_type;
CREATE TYPE league_type AS ENUM ('TOURNAMENT', 'LEAGUE');
ALTER TABLE leagues ALTER COLUMN type TYPE league_type USING type::league_type;
ALTER TABLE leagues ALTER COLUMN type SET DEFAULT 'TOURNAMENT'::league_type;
