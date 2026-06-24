-- Club Profile Enrichment
-- Adds contact_email and social_links to clubs table

ALTER TABLE public.clubs ADD COLUMN contact_email TEXT;
ALTER TABLE public.clubs ADD COLUMN social_links JSONB DEFAULT '{}';
