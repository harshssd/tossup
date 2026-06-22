# TossUp Cricket — Mobile

Expo (SDK 54) React Native app. Home for cricket micro-apps; first one is the
**Practice Tracker**.

## Clubs & teams

- **Register a club** on first launch (the active club is remembered on-device).
  Switch/add clubs from the header chip.
- A club owns the whole roster. Organize players into **teams** (Teams tab) and
  **move players** across teams or back to the unassigned **practice pool** by
  tapping them.
- Practice sessions draw from the whole club pool, regardless of team. (Team-vs-team
  **matches** reuse this same roster and are the next module.)

## Practice Tracker

Tracks net-practice sessions with a custom points game:

- **Squad** — add players to the club, tag each as Batsman / Bowler, and bowlers as
  *Regular* (counted, gets a quota) or *Part-timer*. Shows each player's team.
- **Practice** — create a session (configurable balls-per-batsman, default 24,
  and an out-penalty, default 5).
  - Mark **attendance** by tapping players in arrival order (captures who reached
    the ground first).
  - Assign a **batting order**:
    - 🎲 **Fair** — balances who opens over time. Players who have historically
      batted *lower* get nudged toward the top (70% fairness pull, 30% randomness).
    - 🔀 **Random** — plain shuffle.
    - ➡️ **Arrival** — order by who reached first (per the practice notes).
  - **Live scoring**, with a Batting / Bowling toggle:
    - *Batting* — tap 0/1/2/3/4/6 or OUT for the batter on strike; Undo supported;
      each batter faces a fixed number of balls.
    - *Bowling* — per-bowler spells: tap runs conceded or W per ball; tracks overs,
      runs, wickets, economy (regulars listed first). Undo supported.
  - **Custom rule:** `net score = runs − dismissals × out_penalty`. Getting out
    costs runs, so building an innings beats slogging. Live leaderboard ranks by
    net score.
- **Stats** — continuous (career) stats across all sessions: attendance, runs,
  strike rate, dismissals, net, best net, wickets. Sortable.

## Stack

- expo-router (file-based routing), React 19.1, React Native 0.81
- Supabase (`@supabase/supabase-js`) — direct from the app via anon/publishable
  key + permissive RLS (internal team tool, no auth yet)

## Setup

```bash
cd mobile
npm install
npm start        # then press i / a, or scan the QR in Expo Go
```

`.env` holds the Supabase connection (already configured for the
`tossup-cricket` project):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Database

Supabase project `tossup-cricket` (`byuvtmfarlreoxilrzcx`). Schema migrations live in
`../web/supabase/migrations/`:
- `20260619190000_add_practice_tracker_schema.sql` — `practice_players`,
  `practice_sessions`, `practice_attendance`, `practice_batting`,
  `practice_bowling`, and the `practice_player_stats` view.
- `20260619193000_add_clubs_and_teams_layer.sql` — `clubs`, `practice_teams`, and
  `club_id` / `team_id` columns.

RLS is permissive for `anon` (internal tool, no auth yet — auth + admin roles are a
planned follow-up).

## Adding another micro-app

Add a tab in `app/(tabs)/_layout.tsx` and a screen file; share `lib/supabase.ts`,
`lib/theme.ts`, and `lib/ui.tsx`.
