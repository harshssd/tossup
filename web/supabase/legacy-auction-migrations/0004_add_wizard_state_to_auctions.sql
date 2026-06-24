-- Add wizard_state JSONB column to store wizard form progress for draft auctions
ALTER TABLE public.auctions
ADD COLUMN wizard_state JSONB;

-- Make scheduled_at nullable so drafts don't need a schedule
ALTER TABLE public.auctions
ALTER COLUMN scheduled_at DROP NOT NULL;

-- Make timezone nullable for the same reason
ALTER TABLE public.auctions
ALTER COLUMN timezone DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.auctions.wizard_state IS 'Stores the full wizard form state for draft auctions, allowing users to resume where they left off';
