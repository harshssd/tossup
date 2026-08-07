-- Phase F geo ranking: rank PUBLIC clubs by distance from a point (the viewer's
-- browser geolocation), using the existing km_between() helper. Powers a "Clubs
-- near me" mode on /discover. Anon-callable (public discovery); SECURITY INVOKER
-- (default) so clubs RLS still applies — a caller only ever gets PUBLIC clubs.

CREATE OR REPLACE FUNCTION public.clubs_near(
  p_lat double precision,
  p_lng double precision,
  p_limit int DEFAULT 60
)
RETURNS SETOF public.clubs
LANGUAGE sql
STABLE
AS $$
  SELECT c.*
  FROM public.clubs c
  WHERE (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
    AND c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
  ORDER BY public.km_between(p_lat, p_lng, c.latitude, c.longitude) ASC,
           c.name ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.clubs_near(double precision, double precision, int) TO anon, authenticated;
