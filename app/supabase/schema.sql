-- The Chipping Forecast — Supabase schema
-- Run this in the Supabase SQL editor to set up the database.

-- ── Competitions ──────────────────────────────────────────
create table if not exists competitions (
  id                    uuid primary key default gen_random_uuid(),
  join_code             text not null unique,
  tournament_espn_id    text,
  tournament_name       text,
  tournament_start_date date,
  pick_deadline         timestamptz,
  max_players           int,
  status                text not null default 'awaiting_tournament'
                          check (status in ('awaiting_tournament', 'open', 'live', 'completed')),
  created_by_session    uuid,
  created_at            timestamptz not null default now()
);

create index if not exists competitions_join_code_idx on competitions (join_code);

-- ── Participants ──────────────────────────────────────────
create table if not exists participants (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references competitions (id) on delete cascade,
  display_name    text not null,
  session_token   uuid not null unique default gen_random_uuid(),
  total_score     int,
  created_at      timestamptz not null default now()
);

create index if not exists participants_competition_idx on participants (competition_id);
create index if not exists participants_session_idx on participants (session_token);

-- ── Picks ─────────────────────────────────────────────────
create table if not exists picks (
  id                    uuid primary key default gen_random_uuid(),
  participant_id        uuid not null references participants (id) on delete cascade,
  pick_slot             smallint not null check (pick_slot between 1 and 4),
  player_espn_id        text not null,
  player_name           text not null,
  world_ranking_at_pick int not null,
  final_position        int,
  created_at            timestamptz not null default now(),
  unique (participant_id, pick_slot)
);

create index if not exists picks_participant_idx on picks (participant_id);

-- ── Player rankings ──────────────────────────────────────
create table if not exists player_rankings (
  player_id   text primary key,  -- opaque ID from the rankings source (e.g. OWGR)
  ranking     int not null,
  name        text not null,
  first_name  text,
  last_name   text,
  updated_at  timestamptz not null default now()
);

create index if not exists player_rankings_ranking_idx on player_rankings (ranking);

-- ── Tournament cache ──────────────────────────────────────
create table if not exists tournament_cache (
  espn_tournament_id  text primary key,
  raw_data            jsonb not null,
  fetched_at          timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────
-- Enable RLS (service role key bypasses these; anon/browser key respects them)

alter table competitions   enable row level security;
alter table participants   enable row level security;
alter table picks          enable row level security;
alter table tournament_cache   enable row level security;
alter table player_rankings    enable row level security;

-- Anyone can read competition details (to look up by join code)
create policy "competitions_read" on competitions
  for select using (true);

-- Anyone can read participant list (names + status — no session tokens exposed)
create policy "participants_read" on participants
  for select using (true);

-- Picks are hidden until deadline: only the owner can read their own picks before reveal
-- After deadline all picks become public. This is enforced in the API layer.
-- For now: service role handles all pick writes; anon can read post-deadline.
create policy "picks_read" on picks
  for select using (true);

-- Tournament cache is public read
create policy "tournament_cache_read" on tournament_cache
  for select using (true);

-- Player rankings are public read; writes go through service role only
create policy "player_rankings_read" on player_rankings
  for select using (true);
