# Legacy auction migrations (archived — NOT CLI-managed)

These migrations belong to the **legacy auction Supabase project**
(`offnmpuiogbuxbmhgdck`), used by the original CricketBid auction app via the
untyped `@/lib/supabase` client. They are already deployed there.

They were moved out of `supabase/migrations/` because that directory is managed
by this repo's Supabase CLI, which targets the **platform** project
(`tossup` / `byuvtmfarlreoxilrzcx` = tossup-cricket — all identity, discovery,
pavilion, and tournament work). Mixing both projects' migrations in one
CLI-managed directory was a hazard: a `supabase db reset` (or CI applying every
migration in the dir) would run these auction migrations against the platform DB.
Several tables collide by name across the two projects — most importantly
`tournament_registrations`, `fixtures`, `leagues`, `clubs` — with *different*
shapes, so a reset would have produced the wrong schema and broken the platform
tournament features.

## Rules

- **Do not run these against the platform project.** They are kept here only as
  the historical record of the auction project's schema.
- New platform migrations go in `supabase/migrations/` and are applied to the
  platform project (the active CLI target in `config.toml`).
- If the auction project ever needs CLI-managed migrations again, promote this
  directory into its own Supabase project dir (its own `config.toml`), separate
  from the platform one — do not move it back into `supabase/migrations/`.

## Boundary

- Legacy (here): `0001`–`0004`, `20260219*`, `20260220*`, `20260221*`–`20260226*`
  (auction core, captain/teams, club events, the legacy tournament schema,
  notifications).
- Platform (`supabase/migrations/`): `20260619190000` onward
  (practice tracker, platform consolidation, pavilion, identity phases 0–3,
  tournament write RLS, registration).

`seed.sql` also lives here now — it seeded the auction project's reference tables
(`batting_styles`, `bowling_styles`, `cricket_positions`, `tier_color_presets`,
defined in `20260220010000_add_reference_tables.sql`), which do not exist in the
platform project. Platform seeding is disabled in `config.toml` (`[db.seed]`)
until there is a platform-specific seed.
