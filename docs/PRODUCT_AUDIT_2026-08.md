# TossUp Product Audit — August 2026

Three-track audit: **product/UX journeys** (code-walked, evidence-cited), **code health**
(command-quantified), and **external market research** (sourced). Each proposal below
carries its backing. Fix status is tracked here and in [BACKLOG.md](./BACKLOG.md).

---

## Part 1 — Market research (what the evidence supports)

Competitive landscape (Aug 2026), with sources in the research brief:

| Player | Position | Weakness we exploit |
|---|---|---|
| **CricHeroes** (40M users) | Free ball-by-ball scoring, India-centric | Paywalled basics + ad overload — users call it "greedy" |
| **CricClubs** | De-facto US league/stats backend (16k+ leagues) | Opaque sales-gated pricing, dated UX, mid-match timeouts |
| **TeamSnap** | US team/club ops | Per-team billing (~$7.5–10K/yr for a 35-team club), no cricket features |
| **Spond / Heja** | Free comms/RSVP | Free-forever anchor: clubs won't pay for messaging alone |
| **Pitchero** | UK club website+payments (£30–80/mo) | UK-centric; proves website-as-identity is a paid driver |

**US market signal:** participation +40% since 2018, 200k+ league players, MLC halo
(ticket sales +53% YoY, 6→10 franchises), market projected >$1B by 2030. US metro
leagues run stats on CricClubs and logistics on WhatsApp — **nobody owns the
community/identity layer**, which is exactly TossUp's wedge.

**The five defensible moves the research supports:**
1. **Own the layer CricClubs + WhatsApp leave open** (identity, honors, discovery); share cards ride WhatsApp instead of fighting it.
2. **Ingest scores, don't score.** Scoring is commoditized and free; but a trophy cabinet with no score data breaks the value prop → CricHeroes/CricClubs scorecard ingestion should be promoted from "parked" to "next concrete league ask".
3. **Monetize money-movement first** (registration rails), SaaS second — Spond/TeamSnap/Pitchero all show payments are what clubs pay for.
4. **Publish transparent pricing** — attacks CricClubs'/TeamSnap's sales-gated pricing at their weakest trust point.
5. **Never paywall identity or ad-spam the feed** — the loudest complaint against both cricket incumbents; free player profiles/points tables/honors forever, monetize organizers + sponsors.

---

## Part 2 — Product/UX findings (top 10, evidence-cited)

| # | Finding | Impact | Effort | Fix status |
|---|---|---|---|---|
| U1 | **`/start` (the landing hero CTA) is middleware-blocked** — not in `isPublicRoute`, so every visitor (even platform-signed-in) bounces to the **legacy auction login** | #1 new-player conversion leak; wrong-DB signups | S | ✅ fixed |
| U2 | **Two sign-in systems collide**: `/auctions` bounces to a legacy login whose copy claims to be "your cricket management platform"; legacy success lands on platform `/home` ("Sign in to build your feed"); platform sign-out leaves the legacy session alive | Trust-destroying identity hole; privacy leak on shared machines | M | ✅ fixed (PR 1: honest copy + platform link, legacy auth → /auctions, dual sign-out, OAuth redirect threading) |
| U3 | **Club organizer dead-end**: create → dropped on empty public page; sole door mislabeled "Manage roster"; **no way to edit any club field** (incl. `is_recruiting`, their only discovery lever); no "Your clubs" anywhere; random-suffixed slug unguessable | #1 organizer conversion leak | M | ✅ fixed (PR 2: Club Settings incl. recruiting toggle + re-geocode; create→manage; "Manage club"; Your clubs/tournaments on /account) |
| U4 | **Registration unreachable by default**: `registration_status` frozen at creation (UPCOMING), no tournament edit surface at all; Registrations section hidden when empty; no fixture/team edit (endpoints exist unused) | Register→approve→honors flywheel silently dies; conclude() mints 0 verified honors | M | ✅ fixed (PR 2: Settings + registration OPEN/CLOSE toggle, always-visible Registrations w/ share link, team rename/remove, fixture delete) |
| U5 | **`Permissions-Policy: geolocation=()` blocks the app's own "clubs near me"** — the browser prompt never fires; toast blames the user's settings. Wizard "near you" also ignores city | Headline geo feature dead for 100% of users | S | ✅ fixed |
| U6 | **Notification producers miss the loops that matter**: no notify on join-request creation (→admins), announcements (→members), or registration decisions (→registrant) | Waiting players sit in silence; admins never pinged | M | 🔜 planned — fix PR 3 (retention loops) |
| U7 | **/home empty by default**: joining a club doesn't follow it; Follow only on 2 detail pages; feed excludes SCHEDULED fixtures ("your team plays Saturday" never appears); signed-out state lacks a sign-in CTA | Primary nav tab is an empty page → reason NOT to return | M | ◐ sign-in CTA fixed (PR 1); auto-follow + scheduled fixtures in fix PR 3 |
| U8 | **Profiles are write-only**: no edit route, `/account` rows aren't links, `/start` vs `/player/new` mint divergent duplicate identities, wizard ends in-place | The identity the product is built on can't be viewed/completed/shared by its owner | M | ◐ /account rows now link (PR 1); owner edit + wizard unification in fix PR 3 |
| U9 | **Orphaned-but-reachable legacy surfaces with wrong/missing auth**: unauthenticated `POST /api/clubs/[id]/teams`; no-approval `POST /api/clubs/[id]/join`; divergent second `/tournament/[id]` page whose registration PUT approves without creating a team; dead "System B" notification stack; auction pages have zero exit links | Security holes + state corruption + support burden | M | ✅ fixed (PR 1: purged — incl. the unauthenticated teams API, no-approval join API, divergent /tournament page + registrations API, System B stack) |
| U10 | **Mobile degrades by deletion**: no hamburger (Tournaments + "Start a club" vanish on phones), breakpoint-less 3–4-col create forms, standings table clips, region filter applies on blur (drops input on iOS) | Mobile-first audience (WhatsApp links) hits broken UX on the dominant device | M | 🔜 planned — fix PR 4 (mobile) |

## Part 3 — Code-health findings (top 10, command-quantified)

| # | Finding | Numbers | Fix status |
|---|---|---|---|
| C1 | Lint debt concentrated in legacy: 244 errors / 143 warnings in 53 files; **211 are `no-explicit-any`** in auction code; platform source is at zero errors except one | eslint run 2026-08-15 | ◐ 244→189 errors in PR 1 (autofix + entities + purge; platform at 0); `any` burn-down staged |
| C2 | **Orphaned wizard/legacy-create cluster** (components/wizard, components/leagues, useWizardForm, 4 dead routes, 3 test suites) survived Phase F cleanup; carries ~30 lint errors | importer graph | ✅ deleted |
| C3 | **1,470 lines of untested platform server logic** (pavilion 263, tournament-host 223, home-feed 189, queries 185, club-admin 181, share-card 169) | 14/36 platform libs untested | 🔜 staged (server-suite pattern exists; add with fix PRs 2–3) |
| C4 | 11 `set-state-in-effect` errors in live-auction paths are behavioral (React 19 races); 1 in platform `Pavilion.tsx` | eslint JSON | ✅ Pavilion fixed; auction ones staged with C1 |
| C5 | **Two full auth stacks** (55+23 legacy importers vs 4+8 platform); *cannot* merge (two Supabase projects) but the seam UX can be honest | importer counts | ✅ seam made explicit (U2 fixes); full consolidation = auction-DB migration (parked) |
| C6 | **Radix double-stack + phantom dep**: 7/9 scoped `@radix-ui/*` unused; `checkbox.tsx` imports a package that isn't a direct dependency | npm ls + grep | ✅ fixed |
| C7 | 14 `as unknown as` double-casts in bid/authz paths bypass generated types | grep | 🔜 staged (typed select helpers, with C1 burn-down) |
| C8 | Dead lib modules: `error-handler.ts` (0 importers, 7 lint errors), `permissions.ts` (0 app importers + live test suite), `date-time-picker.tsx` (0 importers) | importer scan | ✅ deleted |
| C9 | Duplicated legacy-vs-platform UI (cards, notification stacks) | inventory | ✅ dead halves purged with U9/C2 |
| C10 | framer-motion confined to legacy auction (21 files, 0 platform) | grep | ✅ lint boundary added (no-restricted-imports for platform) |

---

## Part 4 — Proposals (priority order, research-backed)

**Now (this audit's fix PRs):**
1. **Unblock the two dead features + funnel** (U1, U5) — one-line-class fixes with regression tests. *Backing: these gate every other investment; U1 blocks the #1 CTA, U5 kills the geo differentiator.*
2. **Purge insecure/orphaned legacy surfaces** (U9, C2, C8) — delete the unauthenticated/no-approval APIs, dead pages, dead stacks. *Backing: security exposure + they inflate every future audit.*
3. **Organizer self-serve lifecycle** (U3, U4) — club settings edit, tournament settings + registration toggle, always-visible registrations, fixture edit/delete. *Backing: research Q2 — organizers are the payer; a payer who can't operate their asset churns. Also required for the honors flywheel (verified honors need club-linked registrations).*
4. **Retention loops** (U6, U7, U8) — notify producers for the moments users wait on; auto-follow on join/registration; scheduled fixtures in the feed; profiles viewable/editable by their owners. *Backing: research Q1/Q5 — incumbents lose on comms trust; the digest/feed only works if the graph populates itself.*
5. **Mobile nav + forms** (U10). *Backing: WhatsApp-first audience; research Q3 — US cricket organizes on phones.*
6. **Lint/type burn-down + platform-scoped CI gate** (C1, C4, C7) — platform stays at zero via CI; legacy `any`s burned down with typed select helpers. *(CI itself is in the Production Runbook.)*

**Next (needs product/commercial decisions):**
7. **Promote scorecard ingestion** from parked → next league ask (research move #2: ingest, don't score).
8. **Registration payment rails before SaaS gating** (research move #3; Stripe Connect; fee transparency as marketing).
9. **Publish the pricing page** even pre-Stripe (research move #4 — transparency beats CricClubs/TeamSnap sales-gating).
10. **Codify "never paywall identity"** in the plan as a public commitment (research move #5).

---

*Audit inputs: product/UX agent (10 findings, file:line-cited), code-health agent
(10 findings, command-quantified), market-research agent (5 questions, ~30 sourced
findings). Fix PRs are linked from BACKLOG.md as they merge.*
