# Handoff: The Chipping Forecast — Onboarding & Picks Flow

## Overview

The Chipping Forecast is a lightweight, mobile-first golf prediction game for
small groups of friends. Before a PGA tournament begins, each player picks 4
golfers — one from each world ranking tier (Top 10, 11–20, 21–30, 31+). Once
the tournament is underway, a player's score is the **combined finishing
positions of their 4 picks**. Lowest score wins.

Core constraint: **no accounts, no passwords**. Users enter a display name,
get a personal URL to save, and share a 6-char join code with their group.
Picks are hidden until **1 hour before tee-off**, then reveal and the
leaderboard goes live.

This handoff covers the **happy-path onboarding & picks flow** — 6 screens
from landing → locked-in (pre-deadline hold).

---

## About the Design Files

The files in this bundle are **design references created in HTML** — wireframe
prototypes showing intended structure, information architecture and behavior.
They are **not production code to copy directly.**

The task is to recreate the flows in your existing codebase using whichever
framework and design system you already have in place (React, Vue, SwiftUI,
native, etc.) and your established component patterns. If no environment is
set up yet, choose the stack that best fits your product and implement from
there.

## Fidelity

**Low-fidelity wireframes.**

Intentionally so. These mocks communicate:

- Screen inventory and navigation flow
- Information hierarchy within each screen
- Interaction patterns (sticky headers, tier wizards, bottom sheets, etc.)
- Copy tone and content structure

They do **not** communicate final visual design. The sketchy "Caveat" /
"Architects Daughter" hand-drawn aesthetic, the paper texture, the muted green
accent — all of that is wireframe scaffolding and should be **replaced with
your product's real design system** (brand colors, typography, spacing scale,
component library, iconography).

When in doubt: trust the structure, replace the skin.

---

## The Flow (Happy Path)

6 screens. Host and joiner diverge at step 02, rejoin at 03.

| # | Screen | Role | Purpose |
|---|---|---|---|
| 01 | Landing | Both | Entry point. Start a group or join one. |
| 02a | Create Group | Host | Host sets group name, tournament, deadline. |
| 02b | Join with Code | Joiner | Enter the 6-char invite code. |
| 03 | Display Name | Both | Pick a name. **Save the personal link** — this IS the account. |
| 04 | Pick Golfers | Both | Pick 1 from each of 4 tiers. The core interaction. |
| 05 | Locked In | Both | Holding screen until picks reveal at deadline. |

---

## Screen Details

### 01 — Landing / Welcome

**Purpose:** First-run entry. Two paths: create a group or join one.

**Layout:**
- Centered column, mobile-width.
- Wordmark "The Chipping Forecast" at top.
- One-sentence tagline: *"Pick 4 golfers. Lowest combined finish wins."*
- Two buttons:
  - Primary: **"Start a group"** → Screen 02a
  - Secondary: **"Join with code"** → Screen 02b
- Footer microcopy: *"no sign-up. just a name."*

**State:** None. Pure navigation.

---

### 02a — Create Group (Host)

**Purpose:** Host creates a new group.

**Fields:**
- `groupName` — text, default *"Sunday Sandbaggers"* (suggest a fun default)
- `tournament` — select/picker; shows upcoming PGA events
- `pickDeadline` — **auto-computed as tournament_tee_off − 1 hour** (read-only display, but note "auto" so users understand)

**Primary action:** "Create →" → generates a 6-char invite code, then → Screen 03.

**Behavior:**
- Deadline must always be exactly 1h before first tee-off.
- Group name is editable later by the host.

---

### 02b — Join with Code

**Purpose:** Joiner enters the host's invite code.

**Field:**
- 6-character code, not case-sensitive, formatted visually as `XXX-XXX` (hyphen is cosmetic — do not require it in input).

**Validation:**
- Live validation on 6th char.
- If invalid → inline error *"No group with that code."*
- If valid → preview the group (name, tournament, member count) before fully committing, OR go straight to Screen 03. Spec TBD — recommend preview.

**Primary action:** "Find group →" → Screen 03.

**Source of code:** Text message / DM from the host.

---

### 03 — Display Name + Save Link

**Purpose:** User picks a display name and saves their personal URL.

**This is the highest-risk screen.** There are no passwords — the personal
link (e.g. `chip.fc/m/9k2-Xa7pQ`) is the user's entire means of re-auth. If
they lose it, they lose their account.

**Fields:**
- `displayName` — text input

**On submit:**
- Generate personal URL `chip.fc/m/<token>` (opaque, non-guessable token).
- Show the URL prominently with a prominent warning card:
  *"This link IS your login. Save it."*
- Provide multiple save affordances:
  - **Copy to clipboard** (primary)
  - **Email it to me** (optional but recommended)
  - **Bookmark this page** (iOS/Android native prompt where possible)
- Only after user confirms they've saved it → Screen 04.

**Behavior note:**
- Consider also offering SMS self-delivery ("we'll text it to you") for friction-free save.
- On returning visits, the personal link auto-authenticates — no re-entry needed.

---

### 04 — Pick Golfers (Core Screen)

**Purpose:** Pick 1 golfer from each of 4 world-ranking tiers. Hidden from
the group until deadline.

**Data needed per golfer:**
- World ranking (integer)
- Name
- Betting odds (e.g. `+2500`)
- Recent form: finishing positions in last 5 events (e.g. `T8, T22, CUT, T14, T4`)

**Tier buckets:**
- **Top 10** — ranks 1–10
- **11–20** — ranks 11–20
- **21–30** — ranks 21–30
- **31+** — ranks 31 and below, up to whoever is in the field

**Layout (happy-path variation chosen: single-scroll with sticky headers):**

- **4 tier sections** stacked vertically, each with:
  - A **sticky section header** that pins to the top of the scroll container as you scroll through the tier. Header contains:
    - Tier label (`TOP 10`, `RANKS 11–20`, etc.)
    - Status chip: `✓ picked` (green) / `tap to pick` (amber, for the active tier) / `choose 1 of N` (muted, for unseen)
- **Full tier listings:**
  - Tiers 1–30: show **all 10 golfers** in each bucket.
  - Tier 31+: show **first 10 only**, with a "load more" button that expands to the full field.
- Each golfer row:
  - Radio/checkbox dot on left (selected state fills with accent color)
  - Avatar (placeholder initial in wireframe)
  - `#rank` label
  - Name
  - Odds (right-aligned, muted)
  - Tapping the row selects that golfer for the tier (replaces any previous selection for the same tier).

**Progress indicator:**
- Header shows "N/4" (picked so far).

**Validation:**
- Can't submit until all 4 tiers have a pick.
- Submit button locked as "Pick all 4 to continue" until complete.

**Edit behavior:**
- Picks can be changed any time up until the deadline.
- Changes are saved optimistically, no "save" button needed.

---

### 05 — Locked In (Holding Screen)

**Purpose:** Confirmation + home screen during the pre-deadline wait.
Becomes the default landing after login until the tournament starts.

**Content:**
- "You're in" header
- **Your 4 picks** listed (with ability to tap through to edit until deadline)
- **Countdown timer** to reveal: `HH:MM:SS` until deadline
- Deadline date/time in local zone + ET for reference
- Group status: "N of M players in" with names of who hasn't picked yet
- Link to invite more members (share sheet → copies join code + link)

**After deadline:**
- This screen transitions to the **Reveal + Leaderboard** screens (out of scope for this handoff — see "Screens Not Included" below).

---

## Interactions & Behavior

### Navigation
- Stack-based navigation; back chevron in top-left of every screen past landing.
- Bottom tab bar appears only from Screen 05 onward (`My Picks / Board / Group`).

### Timers
- Countdown on Screen 05 ticks once per second.
- On reaching zero: transition to Reveal screen.

### Persistence
- Personal URL is the auth token. Server issues it on name creation; client stores it but the URL itself is authoritative.
- Picks are synced to the server on every change.
- Groups are keyed by the 6-char invite code.

### Sticky Headers (Screen 04)
- Each tier's section header is `position: sticky; top: 0` within the scroll container.
- As the user scrolls through Top 10 → 11-20, the Top 10 header stays visible until the 11-20 header pushes it out (standard sticky-section behavior).

### Error/Edge cases to handle
- Invalid invite code → inline error on Screen 02b.
- Duplicate display name within a group → append tag (e.g. `Marco#2`) automatically.
- Tournament moved (rain delay, etc.) → deadline auto-updates; notify all members.
- Golfer withdraws before deadline → the pick remains; see TBD rules.
- User loses personal link → no recovery path (design constraint); support contact.

---

## State Management

- **Global state:** current user (display name + personal token), current group
  (code + tournament), pick state (up to 4 golfers).
- **Server state:** authoritative source for groups, members, picks, deadlines, tournament schedule, world rankings, live scores.
- **Real-time updates** needed post-deadline for the live leaderboard (WebSocket or polling); not in scope for this flow but plan for it.

---

## Copy Reference (exact strings from wireframes)

- Landing tagline: *"Pick 4 golfers. Lowest combined finish wins."*
- Landing footer: *"no sign-up. just a name."*
- Display name subtitle: *"No email. No password. Just a name on the board."*
- Link warning: *"This link IS your login. Save it."*
- Locked-in subtitle: *"Hidden from your group until Thu 7 AM. No one can see — not even us."*

---

## Design Tokens (Wireframe — Replace With Your System)

The wireframes use placeholder tokens. Your real implementation should use
your product's existing design system instead. For reference:

| Token | Wireframe value | Purpose |
|---|---|---|
| `--ink` | `#1A1A1A` | Primary text / structure |
| `--paper` | `#FAF8F3` | Background |
| `--accent` | `#4A6B4A` (muted green) | Primary action / "picked" state |
| `--accent-soft` | `#DDE5D8` | Success background |
| `--warn` | `#A86B3C` (muted terracotta) | Attention / warnings |
| `--warn-soft` | `#EADDCB` | Warning background |

Typography (wireframe only): `Caveat` + `Architects Daughter` + `JetBrains
Mono`. **Replace with your product fonts.**

Spacing: 4/8/12/16/24 scale, 6–10px radii. Adapt to your system.

---

## Assets

No custom assets in the wireframes — all visuals are CSS, SVG, or emoji
placeholders. Real implementation will need:

- Tournament images/logos (provided by PGA feed or curated)
- Golfer avatars (headshots from a sports data provider)
- App icon / wordmark (to be designed)

---

## Screens NOT Included in This Handoff

The following screens are implied by the product but were not wireframed —
design pass needed before implementation:

- **Reveal** — the moment picks go public (card-flip or similar).
- **Live leaderboard** — numbers-first table + visual chip view.
- **Player detail** — my 4 picks with their live positions.
- **Finished / winner** — end-of-tournament state.
- **Returning via personal link** — "welcome back" auto-auth.

---

## Files Included

- `wireframes/Wireframes.html` — the full wireframe document (storyboard +
  variations + notes). Open in a browser to reference structure and behavior.

---


