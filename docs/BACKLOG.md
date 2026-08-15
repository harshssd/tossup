# TossUp Backlog

Working backlog structured around the phases in [PRODUCT_PLAN.md](./PRODUCT_PLAN.md).
Each item ships as one or more reviewed PRs. Quality gates from `web/`:
`npm run type-check`, `npm run lint`, `npm run build`, `npm test`.

> **Status (2026-08-15): Phases A–F and the entire polish set are SHIPPED** (PRs #18–#43).
> The active backlog is now the [Audit fixes](#audit-fixes-2026-08) section below.
> For go-live infrastructure work, see the Production Readiness Runbook (P0–P3).

## Phase A — One front door + shareable pages — ✅ SHIPPED (PR #18)

- [x] **A1** Landing re-pointed at the platform (PlatformShell, CTAs → /discover, /club/new, /tournaments/new).
- [x] **A2** `/tournaments` index + Clubs/Tournaments/Players nav + "Start a club" CTA.
- [x] **A3** `generateMetadata` + dynamic OG images on club/tournament pages.
- [x] **A4** `ShareButton` (Web Share/copy/WhatsApp) on heroes + MatchCard.

## Phase B — The Honors Board — ✅ SHIPPED (PRs #19–#21)

- [x] **B0–B2** `honors` + `honor_squad_members`, Trophy Cabinet, add-honor form (PR #19; + merge-guard fix migration).
- [x] **B3** Conclude tournament → `TOSSUP_VERIFIED` honors + champions banner (PR #20; consent hardening).
- [x] **B3b** Honor rejection opt-out ("Not us") (PR #21).
- [x] **B4** Player honors ribbon.

## Phase C — Club life — ✅ SHIPPED (PRs #22–#25)

- [x] **C1/C2** Platform `club_events` + `event_rsvps`, Upcoming section, manage CRUD, RSVP counts (PR #22).
- [x] **C3** Internal club-scoped leagues (PR #23).
- [x] **C4** Club Pavilion (admin announcements board) (PR #24).
- [x] **C5** ICS export `/api/clubs/[id]/events.ics` (PR #25).

## Phase D — "New in town" funnel — ✅ SHIPPED (PRs #26–#28)

- [x] **D2** Club join requests + admin approve/reject (PR #26).
- [x] **D1/D3** `/start` onboarding wizard + recruiting board on /discover (PR #27).
- [x] **D4** Reputation v1 (nightly pg_cron scoring) (PR #28).

## Phase E — Social presence / marketing kit — ✅ SHIPPED (PRs #29–#33)

- [x] **E1** Result share-cards (PR #29) + champions/match-announced cards (E1.x, PR #32).
- [x] **E2** Club microsite branding: crest/cover/accent + Storage RLS (PR #30); storage cleanup + `/embed/club/[slug]` widget (E2.x, PR #33).
- [x] **E3** `follows` + personal `/home` feed (PR #31).

## Phase F — Consolidation & hygiene — ✅ SHIPPED (PRs #34–#38)

- [x] Legacy route retirement: `/explore`, `/dashboard`, `/clubs` + `/leagues` index pages → platform equivalents (PR #34; files deleted in PR #38). Auction operational deep routes kept.
- [x] Platform notifications: table + `notify()` producer + bell + join-request wiring (PR #35).
- [x] Event-reminder producer (hourly pg_cron) (PR #36).
- [x] Auction repositioned as "Player auction night" add-on on tournament manage (PR #37).

## Post-roadmap polish — ✅ SHIPPED (PRs #38–#43)

- [x] Legacy file cleanup (PR #38).
- [x] Reputation v2: recency signals, admin recompute-now (throttled), signals-breakdown card (PR #39).
- [x] `/notifications` full-page inbox (PR #40).
- [x] Geo "clubs near me" (`clubs_near` + browser geolocation + distance chips) (PR #41).
- [x] Follows weekly digest (pg_cron → in-app, email-ready) (PR #42).
- [x] Geocode clubs on save (free OSM Nominatim, auth-gated + throttled proxy) (PR #43).

Three pg_cron jobs live: `recompute-reputation` (nightly), `send-event-reminders` (hourly), `send-follows-digest` (weekly).

## Audit fixes (2026-08)

Findings from the 2026-08 product/code audit (see [PRODUCT_AUDIT_2026-08.md](./PRODUCT_AUDIT_2026-08.md)
for evidence and research backing). Items get checked as fix PRs merge.

### Fix PR 1 — critical unblocks + purge
- [x] **U1** `/start` added to the public-route gate (was bouncing the landing hero CTA to the legacy auction login) + regression tests (`route-gates.ts` extraction).
- [x] **U5** `Permissions-Policy: geolocation=(self)` (empty allow-list blocked the app's own "clubs near me") + wizard city now feeds the match query.
- [x] **U2** Auth-seam honesty: legacy login renamed "TossUp Auction" + platform sign-in link; legacy auth lands on `/auctions` (not a platform page's sign-in gate); `?redirect` threaded through Google OAuth; Sign out signs out BOTH sessions; auction add-on card says "own sign-in".
- [x] **U9/C2/C8/C9** Purge: unauthenticated `POST /api/clubs/[id]/teams`, no-approval join API, divergent `/tournament/[id]` + registrations API, System-B notification stack, wizard/legacy-create cluster, dead libs (`error-handler`, `permissions`, `date-time-picker`) — with redirect coverage + guard-test updates.
- [x] **C4 (platform)** `Pavilion.tsx` set-state-in-effect fixed → platform source at **zero lint errors**.
- [x] **C6** Radix phantom dep + 7 unused scoped packages + `date-fns` removed.
- [x] **C10** framer-motion lint boundary (legacy-only).
- [x] **C1 (trivial tier)** 244 → 189 lint errors (autofix + entity escapes + purge).
- [x] **U7/U8 slices** `/home` signed-out sign-in CTA; `/account` profile rows are links.

### Fix PR 2 — organizer self-serve lifecycle (U3, U4) — ✅ shipped
- [x] Club Settings on manage (all create-form fields incl. `is_recruiting`/`roles_needed`, re-geocodes on location change); create → manage redirect; "Manage club" naming; "Your clubs" + "Your tournaments" on /account.
- [x] Tournament Settings on manage (name/dates/venue/max-teams + registration OPEN/CLOSE toggle); Registrations always visible with public-link share hint; team rename/remove; fixture delete.

### Fix PR 3 — retention loops (U6, U7, U8) — ✅ shipped
- [x] notify() producers: join-request created → club admins (trigger, manage deep-link); registration decided → registrant (trigger covers approve + reject paths). Announcements→members deferred (fan-out sizing decision).
- [x] Auto-follow club on join approval (in decide fn) + tournament on registration approval (in trigger), both visibility-gated.
- [x] SCHEDULED fixtures from followed tournaments in the /home "Upcoming" section ("your team plays Saturday").
- [x] /player/[id]/edit (owner-gated) + "Edit your profile" affordance; /player/new redirects to the existing profile's edit (no more divergent duplicate identities); wizard ends with a profile CTA.

### Fix PR 4 — mobile (U10) — ✅ shipped
- [x] MobileNav menu (full link set + Start a club + Host); create-form grid breakpoints (`grid-cols-1 sm:grid-cols-3`, points row `grid-cols-2 sm:grid-cols-4`); StandingsTable horizontal scroll; region filter applies on submit (was onBlur — iOS dropped it).

### Staged (with the above)
- [ ] **C1/C7** Legacy `any` burn-down via typed select helpers (bid/authz paths first); auction `set-state-in-effect` refactors.
- [ ] **C3** Server-side suites for pavilion / tournament-host / home-feed / queries / club-admin.

### Research-backed strategy items (decisions, then build)
- [ ] Promote **scorecard ingestion** from parked → next concrete league ask ("ingest, don't score").
- [ ] **Registration payment rails before SaaS gating** (Stripe Connect; transparent fees).
- [ ] Publish a **transparent pricing page** (pre-Stripe) — counters CricClubs/TeamSnap sales-gating.
- [ ] Codify **"never paywall identity"** in PRODUCT_PLAN as a public commitment.

## Parked (do not build speculatively)

- CricHeroes ingestion (schema exists; wait for a concrete league to ask). Bulk import would also need a self-hosted/paid geocoder tier.
- Player premium features (needs network density first).
- Seasons table (`year` + `season_label` on honors is enough for now).

## Needs external accounts / decisions (not code-blocked)

- Email delivery for the digest + notifications (SMTP/Resend secret; digest rows are email-ready).
- Stripe monetization (PRODUCT_PLAN Part 3) — test-mode keys + pricing decisions.
- Production go-live wiring — see the Production Readiness Runbook (Vercel root dir + env, Supabase auth URLs, migration-history reconcile, CI, backups, error tracking).
