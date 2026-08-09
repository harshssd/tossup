-- Global rate gate for the /api/geocode proxy, aligned to OpenStreetMap
-- Nominatim's usage policy (max ~1 req/sec, no bulk). The route's auth gate
-- limits WHO can call; this limits HOW FAST platform-wide, so a signed-in user
-- looping distinct queries can't burst Nominatim and get our IP blocked.
-- Serverless-safe (shared DB state, not per-instance memory).

CREATE TABLE IF NOT EXISTS public.geocode_throttle (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_call timestamptz NOT NULL DEFAULT to_timestamp(0)
);
INSERT INTO public.geocode_throttle (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.geocode_throttle ENABLE ROW LEVEL SECURITY; -- no policies: definer-only

-- Atomically claim a ~1-second slot. Returns true if claimed (caller may hit
-- Nominatim), false if another call claimed it within the last second (caller
-- skips — geocoding is best-effort). The WHERE + row lock serializes callers.
CREATE OR REPLACE FUNCTION public.claim_geocode_slot()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.geocode_throttle
    SET last_call = now()
    WHERE last_call <= now() - interval '1 second';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_geocode_slot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_geocode_slot() TO authenticated;
