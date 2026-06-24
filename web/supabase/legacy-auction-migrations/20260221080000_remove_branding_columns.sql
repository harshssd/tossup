-- Remove branding columns (colors, logos, banners) from all tables
-- These features were half-implemented placeholders and will be re-added deliberately later

ALTER TABLE leagues DROP COLUMN IF EXISTS logo, DROP COLUMN IF EXISTS banner, DROP COLUMN IF EXISTS primary_color;
ALTER TABLE clubs DROP COLUMN IF EXISTS logo, DROP COLUMN IF EXISTS banner, DROP COLUMN IF EXISTS primary_color;
ALTER TABLE teams DROP COLUMN IF EXISTS logo, DROP COLUMN IF EXISTS primary_color, DROP COLUMN IF EXISTS secondary_color;
ALTER TABLE auctions DROP COLUMN IF EXISTS logo, DROP COLUMN IF EXISTS banner, DROP COLUMN IF EXISTS primary_color, DROP COLUMN IF EXISTS secondary_color, DROP COLUMN IF EXISTS bg_image, DROP COLUMN IF EXISTS font, DROP COLUMN IF EXISTS theme_preset, DROP COLUMN IF EXISTS tagline;
DROP TABLE IF EXISTS team_color_presets;
