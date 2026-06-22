# TossUp Cricket — Architecture

## Overview

`mobile/` is an Expo (SDK 54, expo-router) app meant to host several small cricket
apps for the same club/team. The first is the **Practice Tracker**; **Matches** is
the next module (schema already in place). It talks directly to Supabase from the
device with the anon/publishable key.

```
Expo app (expo-router)
 ├─ app/(tabs)        Practice · Squad · Teams · Stats
 ├─ app/club/select   club registration / switcher (gate)
 ├─ app/session/*     setup → live scoring → summary
 ├─ lib/club.tsx      active-club context (AsyncStorage)
 ├─ lib/api.ts        thin typed wrappers over supabase-js
 ├─ lib/scoring.ts    net score + fair batting order
 └─ lib/{supabase,types,theme,ui}
        │  anon key + permissive RLS
        ▼
Supabase project  tossup-cricket (byuvtmfarlreoxilrzcx)
```

## Data model

```
clubs ─┬─< practice_teams ──┐
       ├─< practice_players >┘ (team_id, ON DELETE SET NULL → "practice pool")
       ├─< practice_sessions ─┬─< practice_attendance (batting_order, arrival_order)
       │                      ├─< practice_batting   (one row / player / session)
       │                      └─< practice_bowling   (one row / player / session)
       └─< matches ──< match_lineups                 (team-vs-team, fluid lineups)

view practice_player_stats  → career aggregates per player
```

### Key decisions

- **Club is the tenancy root.** Everything hangs off `club_id`; the app scopes all
  reads to the active club. This is the seam where real auth/multi-tenant RLS will
  later attach (see Roadmap).
- **Players belong to one club, optionally one team.** "Move across teams" = update
  `players.team_id`; `NULL` = the unassigned practice pool. A real person who plays
  for two clubs is two rows — there is intentionally no global player identity yet.
- **Matches snapshot their lineup** (`match_lineups`) instead of reading live
  `team_id`, because team membership is fluid and we want historical accuracy.
- **Custom scoring is per-session config**, not hard-coded: `balls_per_batsman`
  (default 24) and `out_penalty` (default 5). Net score = `runs − dismissals ×
  out_penalty`, computed live in the app and (correctly) in the stats view.
- **`status` is TEXT + CHECK** rather than a Postgres enum — easier to evolve in a
  young schema; can be promoted to an enum later.

## Architecture review — issues found & resolved

1. **Stats view fan-out (bug, fixed in migration v3).** The first version of
   `practice_player_stats` LEFT JOINed `practice_attendance`, `practice_batting`,
   and `practice_bowling` onto the player in a single query. With >1 row in two of
   those tables the join cross-multiplies, so every `SUM` overcounts (a player with
   2 sessions had their runs counted 2×). The seed data masked it (exactly one row
   each). **Fix:** aggregate each child table in its own CTE, then join the
   per-player rollups — no fan-out.

2. **Stale net score (fixed).** The old view summed a *stored* `net_score`. If a
   session's `out_penalty` were edited later, the stored value drifted. The view now
   derives net from each session's live `out_penalty`
   (`SUM(runs − dismissals × out_penalty)`). The stored column remains for the live
   leaderboard but is no longer the source of truth for career stats.

3. **Auth not modelled.** Internal tool today; RLS is permissive for `anon`. Added a
   nullable `clubs.created_by` now so wiring ownership later is non-breaking.

## Known limitations / tradeoffs

- **No auth / open RLS** — anyone with the anon key can read/write any club. Fine for
  a private team tool; must change before any public release.
- **No realtime / optimistic-only** — screens refetch on focus. Single-scorer live
  scoring is fine; concurrent scorers can clobber each other.
- **Bowling** has storage + stats but in-session entry is the newest piece; the
  bowler-rotation helper from the practice notes (spells, 1-over openers, one bowler
  per team on at all times) is a candidate next step.

## Roadmap

1. **Matches module UI** — schema is live (`matches`, `match_lineups`); build
   setup (pick two teams + lineups + toss) → two-innings scoring (reuse
   `lib/scoring`) → result.
2. **Auth + roles** — Supabase Auth; `club_members(club_id, user_id, role)`;
   tighten RLS from `anon` to membership-based. `clubs.created_by` is the anchor.
3. **Bowler rotation planner** — encode the WhatsApp practice rules.
4. **Realtime** — Supabase channels for multi-device live scoring.
