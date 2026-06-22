-- Advisor fixes: views respect caller RLS; function search_path pinned.
ALTER VIEW public.tournament_standings  SET (security_invoker = on);
ALTER VIEW public.practice_player_stats SET (security_invoker = on);
ALTER FUNCTION public.km_between(double precision, double precision, double precision, double precision) SET search_path = pg_catalog;
