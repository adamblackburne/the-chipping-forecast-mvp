# The Chipping Forecast

A mobile-first golf competition app. Users create or join groups, pick 4 golfers across world-ranking brackets, and compete on a live leaderboard during PGA Tour events.

## Path Note for Claude Code

Use the symlink for all file operations — it avoids the curly apostrophe in the real path:

```
/Users/adamblackburne/projects/chipping-forecast
```

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** — custom design tokens in `app/app/globals.css`
- **Supabase** (PostgreSQL + RLS) — client in `app/lib/supabase.ts`
- **ESPN Golf API** — leaderboards, fields, tournament schedule (`app/lib/espn.ts`)
- **DataGolf** (optional) — world rankings stored in Supabase, fetched via `app/lib/rankings.ts`
- **Vercel** deployment; `MOCK_NEXT_TOURNAMENT=1` env var injects a fake tournament on preview branches

All code lives under `app/` (the Next.js project root). Run commands from there.

## Dev Commands

```bash
cd app
npm run dev      # localhost:3000
npm run build
npm run lint
```

## Directory Structure

```
app/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── create/page.tsx           # Create a group
│   ├── join/page.tsx             # Enter join code
│   ├── join/[code]/page.tsx      # Preview group before joining
│   ├── setup/[code]/page.tsx     # Post-join: save personal link
│   ├── leaderboard/page.tsx      # Global live leaderboard
│   ├── competition/[code]/
│   │   ├── page.tsx              # Group hub
│   │   ├── picks/page.tsx        # Make/view picks
│   │   ├── board/page.tsx        # Group leaderboard
│   │   ├── board/field/page.tsx  # Full tournament field
│   │   └── group/page.tsx        # Group members list
│   └── api/
│       ├── tournaments/          # GET: { inPlay, next, past }
│       ├── players/              # GET: ranked field for a competition (?code=)
│       ├── picks/                # GET/POST: user picks (x-session-token)
│       ├── competition/          # POST: create group
│       ├── competition/join/     # POST: join group → returns sessionToken
│       ├── competition/[code]/   # GET: comp details; auto-links tournament if awaiting
│       ├── competition/[code]/leaderboard/   # GET: scored leaderboard
│       ├── competition/[code]/participants/  # GET: member list + pick status
│       ├── competition/[code]/field/         # GET: tournament field + group pick highlights
│       └── admin/rankings/       # POST: bulk upsert world rankings (x-admin-secret)
├── components/
│   ├── layout/   MobileShell, TopBar, TabBar
│   ├── ui/       Button, Input, Chip, Divider, Tile
│   ├── picks/    TierSection, GolferRow, PickProgress
│   ├── competition/  CountdownTimer, PickSummary, ParticipantList
│   └── onboarding/   JoinCodeInput, PersonalLinkCard, TournamentBanner
└── lib/
    ├── supabase.ts     # DB client (lazy singleton + service role)
    ├── session.ts      # localStorage session helpers
    ├── espn.ts         # ESPN API: fetchTournamentPair, fetchLeaderboard, fetchTournamentField
    ├── rankings.ts     # fetchWorldRankings() from Supabase player_rankings table
    ├── datagolf.ts     # filterByBracket() — splits players into 4 ranking tiers
    └── scoring.ts      # scoreParticipant(), sortMembers()
```

## Database Schema

### competitions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| join_code | text unique | 6-char A-Z2-9 |
| status | text | `awaiting_tournament` \| `open` \| `live` \| `completed` |
| tournament_espn_id | text | null until linked |
| tournament_name | text | null until linked |
| tournament_start_date | date | |
| pick_deadline | timestamptz | 1hr before first tee |
| cut_position_snapshot | int | locked at R3+ start |
| created_by_session | uuid | creator's session token |
| max_players | int | optional cap |

### participants
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| competition_id | uuid → competitions | |
| display_name | text | auto-uniquified on join |
| session_token | uuid unique | browser auth token |

### picks
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| participant_id | uuid → participants | |
| pick_slot | smallint 1–4 | one per bracket tier |
| player_espn_id | text | |
| player_name | text | |
| world_ranking_at_pick | int | |
| unique (participant_id, pick_slot) | | one pick per slot |

### player_rankings
Populated by admin import. Columns: `player_id`, `ranking`, `name`, `first_name`, `last_name`.

## Competition Status Lifecycle

```
awaiting_tournament  →  open  →  live  →  completed
```

- **awaiting_tournament → open**: Automatic. `GET /api/competition/[code]` checks ESPN on every load (cached 10 min). When a `"pre"` tournament appears, it's linked and status flips to `"open"`.
- **open → live**: Manual (not yet automated).
- **live → completed**: Manual (not yet automated).

**Key condition — "field not available"**: Status can be `"open"` (tournament linked) but `/api/players` returns `{ players: [] }` because ESPN hasn't published the field yet. This is the "tournament scheduled, picks not yet possible" state. The picks page shows "Tournament upcoming" and setup routes new users to the group hub.

## Session & Auth

- No email/password. Each user gets a UUID `sessionToken` on join.
- Stored in `localStorage` as `tcf_session`: `{ sessionToken, displayName, competitionCode }`.
- Passed to API routes via `x-session-token` header.
- Personal link format: `/competition/[code]?t=[sessionToken]` — hydrates localStorage on arrival, then strips the param from the URL.
- `getSession()` / `saveSession()` in `lib/session.ts`.

## Pick Brackets (Tiers)

`filterByBracket(players, slot)` in `lib/datagolf.ts`:
- Slot 1 → world ranking 1–10
- Slot 2 → world ranking 11–20
- Slot 3 → world ranking 21–30
- Slot 4 → world ranking 31+

## Scoring Logic (`lib/scoring.ts`)

```
score(pick) =
  CUT/WD/DQ  →  lastCutPosition + 1
  otherwise  →  numeric finishing position
  
total = sum of 4 pick scores
```

Tiebreaker: sorted pick positions compared slot-by-slot (ascending). Final fallback: alphabetical.

`cut_position_snapshot` is written to the DB once `currentRound >= 3` so the cut line can't drift as R3/R4 finishers move up.

## Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
MOCK_NEXT_TOURNAMENT=0          # Set 1 on preview branches to inject fake tournament
ADMIN_SECRET=                   # For POST /api/admin/rankings
DATAGOLF_API_KEY=               # Optional
```

## Design Tokens

Custom Tailwind CSS colours (defined in `globals.css`):

| Token | Value | Usage |
|---|---|---|
| `ink` | `rgb(26 26 26)` | Primary text |
| `ink-2` | `rgb(74 74 74)` | Secondary text |
| `ink-3` | `rgb(138 138 138)` | Tertiary / placeholder |
| `paper` | `rgb(250 248 243)` | Page background |
| `paper-2` | `rgb(241 238 228)` | Card / strip background |
| `accent` | `rgb(74 107 74)` | Brand green |
| `accent-soft` | `rgb(221 229 216)` | Accent tint (current user row) |
| `warn` | `rgb(168 107 60)` | CUT/WD/DQ highlight |
| `line-soft` | subtle border | Dividers |

Fonts: **Fraunces** (`font-display`) for headlines · **Inter** (`font-sans`) for body · **JetBrains Mono** (`font-mono`) for scores/codes.
