# TossUp Backlog

Working backlog structured around the phases in [PRODUCT_PLAN.md](./PRODUCT_PLAN.md).
Each item should ship as one or more reviewed PRs. Quality gates from `web/`:
`npm run type-check`, `npm run lint`, `npm run build`.

## Phase A — One front door + shareable pages

- [ ] **A1** Re-point landing page (`src/app/page.tsx`) at the platform: server component, `PlatformShell`, CTAs → `/discover`, `/club/new`, `/tournaments/new`; auction demoted to a footer/"Tools" link; legacy Supabase auth call removed.
- [ ] **A2** `/tournaments` index page (reuse `listTournaments` + `TournamentCard`); add Clubs / Tournaments / Players links + "Start a club" CTA to `PlatformShell` nav.
- [ ] **A3** `generateMetadata` on `club/[slug]`, `player/[id]`, `tournaments/[id]`, `/discover`; dynamic OG images (`opengraph-image.tsx`, `next/og`) for club and tournament pages.
- [ ] **A4** `ShareButton` (Web Share API + copy-link + WhatsApp deep link) on club/tournament/player heroes and `MatchCard` results.

## Phase B — The Honors Board

- [ ] **B0** Migration: `honors` + `honor_squad_members` tables; `leagues.concluded_at` / `champion_team_id` / `runner_up_team_id`; RLS (public read gated on club visibility, `is_scope_admin` writes, `TOSSUP_VERIFIED` only via fn); update `database.types.ts`.
- [ ] **B1** Club "Trophy Cabinet" on `club/[slug]` — honors grouped by year, captain + squad chips, selling empty state.
- [ ] **B2** Add-honor form on `club/[slug]/manage` (captain/squad pickers from roster Persons).
- [ ] **B3** "Conclude tournament" on `tournaments/[id]/manage` via SECURITY DEFINER `conclude_tournament` fn (mirrors `approve_registration`); champions banner on tournament page.
- [ ] **B4** Player honors ribbon on `player/[id]`.

## Phase C — Club life: events, pavilion, internal leagues

- [ ] **C1** Migration: platform `club_events` + `event_rsvps` (person-keyed RSVPs); port + restyle `EventCard/EventForm/EventList`, reuse `lib/validations/event.ts` shapes; platform client-lib data access.
- [ ] **C2** Club page "Upcoming" section + `/club/[slug]/events`; event CRUD on manage page; RSVP counts.
- [ ] **C3** "Start an internal league" button on club manage (pre-fills `club_id` + PRIVATE in `/tournaments/new`).
- [ ] **C4** Club Pavilion: `tournament_posts.league_id` DROP NOT NULL + nullable `club_id` + one-of check + RLS; `Pavilion.tsx` scope prop.
- [ ] **C5** ICS export at `/api/clubs/[id]/events.ics`.

## Phase D — "New in town" funnel

- [ ] **D1** `/start` onboarding wizard → `looking_for_club` profile → nearby recruiting clubs (`km_between`) + public events.
- [ ] **D2** Join requests: `club_join_requests` table + "Ask to join" on club page + admin approve → membership.
- [ ] **D3** Recruiting board surfacing on `/discover` (recruiting clubs ↔ available players).
- [ ] **D4** Reputation v1: nightly pg_cron/edge scoring job updating `reputation_score`.

## Phase E — Social presence / marketing kit

- [ ] **E1** Branded 1080×1080 result/champions/fixture share images (`next/og` route handler).
- [ ] **E2** Club microsite polish: crest upload (platform Supabase Storage), cover photo, accent color, `?embed=` mode.
- [ ] **E3** `follows` table + personal `/home` feed.

## Phase F — Consolidation & hygiene (parallel/background)

- [ ] Redirect `/explore` + `/explore/club/[slug]` → `/discover` + `/club/[slug]`; `/tournament/[id]` → `/tournaments/[id]`.
- [ ] Redirect `/clubs`, `/leagues`, `/dashboard` once C-phase parity lands.
- [ ] Reposition auction as "Player auction night" module linked from tournament manage.
- [ ] Platform notifications table + event-reminder producer.

## Parked (do not build speculatively)

- CricHeroes ingestion (schema exists; wait for a concrete league to ask).
- Email digests (hangs off E3 follows).
- Player premium features (needs B–D data first).
- Seasons table (`year` + `season_label` on honors is enough for now).
