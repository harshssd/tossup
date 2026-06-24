-- Add runtime_state JSONB column to auctions for live auction state persistence
ALTER TABLE public.auctions
ADD COLUMN runtime_state JSONB;
