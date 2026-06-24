-- Anonymous RLS for Public Clubs
-- Replaces auth-required SELECT policy with anonymous-accessible policy
-- Enables server-rendered public pages and unauthenticated browse

-- Drop existing auth-required public clubs policy
DROP POLICY IF EXISTS "Public clubs are viewable by authenticated users" ON public.clubs;

-- Create new policy allowing anonymous reads for PUBLIC visibility
CREATE POLICY "Public clubs are viewable by anyone" ON public.clubs
FOR SELECT USING (visibility = 'PUBLIC');

-- Also update leagues for the explore page tournaments tab
DROP POLICY IF EXISTS "Public leagues are viewable by authenticated users" ON public.leagues;

CREATE POLICY "Public leagues are viewable by anyone" ON public.leagues
FOR SELECT USING (visibility = 'PUBLIC');
