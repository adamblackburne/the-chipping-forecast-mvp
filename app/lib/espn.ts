const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";

export interface EspnTournament {
  id: string;
  name: string;
  shortName: string;
  startDate: string;   // ISO string
  endDate: string;
  status: "pre" | "in" | "post";
  firstTeeTime: string | null;  // ISO string, null if not yet published
  venue: string;
}

export interface EspnPlayer {
  id: string;
  displayName: string;
  shortName: string;
  worldRanking: number;
  odds: string | null;       // e.g. "+2500"
  recentForm: string[];      // last 5 finishes e.g. ["T8","T22","CUT","T14","T4"]
}

export interface EspnLeaderboardEntry {
  playerId: string;
  displayName: string;
  position: number | null;
  positionDisplay: string;  // "T12", "CUT", "WD", "DQ", etc.
  status: "active" | "cut" | "wd" | "dq" | "complete";
  score: number | null;
  worldRanking: number;
}

interface RawEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  endDate?: string;
  status?: { type?: { state?: string; name?: string } };
  competitions?: Array<{
    startDate?: string;
    venue?: { fullName?: string };
    competitors?: RawCompetitor[];
  }>;
}

interface RawCompetitor {
  id?: string;
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
  };
  status?: {
    position?: { displayValue?: string; value?: number };
    type?: { name?: string };
  };
  score?: { value?: number };
  linescores?: unknown[];
}

function parseStatus(raw: string | undefined): "pre" | "in" | "post" {
  if (!raw) return "pre";
  const s = raw.toLowerCase();
  if (s.includes("in") || s.includes("progress")) return "in";
  if (s.includes("post") || s.includes("final") || s.includes("complete")) return "post";
  return "pre";
}

function parsePlayerStatus(statusName: string | undefined): EspnLeaderboardEntry["status"] {
  if (!statusName) return "active";
  const s = statusName.toUpperCase();
  if (s.includes("CUT") || s.includes("MC")) return "cut";
  if (s.includes("WD") || s.includes("WITHDRAW")) return "wd";
  if (s.includes("DQ") || s.includes("DISQUALIF")) return "dq";
  return "active";
}

/** Fetch the current/upcoming PGA Tour event. */
export async function fetchCurrentTournament(): Promise<EspnTournament | null> {
  const { inPlay, next } = await fetchTournamentPair();
  return next ?? inPlay;
}

/**
 * Fetch both the in-progress tournament (if any) and the next upcoming tournament open for picks.
 * - inPlay: the tournament currently underway (status "in"), or null
 * - next: the nearest "pre" tournament available for picks, or null (falls back to most recent "post" only when nothing else exists)
 */
function mockPreTournament(): RawEvent {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "mock-tournament",
    name: "Mock Golf Tournament",
    shortName: "Mock Golf",
    date: start,
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: { type: { state: "pre", name: "STATUS_SCHEDULED" } },
    competitions: [{ startDate: start, venue: { fullName: "Mock Golf Club" }, competitors: [] }],
  };
}

export async function fetchTournamentPair(): Promise<{
  inPlay: EspnTournament | null;
  next: EspnTournament | null;
}> {
  const res = await fetch(`${ESPN_BASE}/leaderboard`, { next: { revalidate: 600 } });
  if (!res.ok) return { inPlay: null, next: null };
  const data = await res.json() as { events?: RawEvent[] };
  const events: RawEvent[] = data.events ?? [];

  if (process.env.MOCK_NEXT_TOURNAMENT === "1") {
    events.push(mockPreTournament());
  }

  const inPlay = events.find((e) => parseStatus(e.status?.type?.state) === "in") ?? null;

  const upcoming = events
    .filter((e) => parseStatus(e.status?.type?.state) === "pre")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

  // Off-season fallback: show most recent finished tournament
  const fallback = !upcoming
    ? (events
        .filter((e) => parseStatus(e.status?.type?.state) === "post")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null)
    : null;

  return {
    inPlay: inPlay ? adaptTournament(inPlay) : null,
    next: upcoming ? adaptTournament(upcoming) : (fallback ? adaptTournament(fallback) : null),
  };
}

function adaptTournament(e: RawEvent): EspnTournament {
  const comp = e.competitions?.[0];
  return {
    id: e.id,
    name: e.name,
    shortName: e.shortName ?? e.name,
    startDate: e.date,
    endDate: e.endDate ?? e.date,
    status: parseStatus(e.status?.type?.state),
    firstTeeTime: comp?.startDate ?? null,
    venue: comp?.venue?.fullName ?? "",
  };
}

/** Fetch field (players) for a tournament, with world rankings. */
export async function fetchTournamentField(tournamentId: string): Promise<EspnPlayer[]> {
  const res = await fetch(
    `${ESPN_BASE}/leaderboard?event=${tournamentId}`,
    { next: { revalidate: 600 } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { events?: RawEvent[] };
  const event = data.events?.find((e) => e.id === tournamentId) ?? data.events?.[0];
  const competitors = event?.competitions?.[0]?.competitors ?? [];

  return competitors
    .map((c: RawCompetitor): EspnPlayer | null => {
      const id = c.athlete?.id ?? c.id;
      if (!id) return null;
      return {
        id,
        displayName: c.athlete?.displayName ?? "Unknown",
        shortName: c.athlete?.shortName ?? "",
        worldRanking: 999, // ESPN doesn't reliably expose ranking; DataGolf fills this
        odds: null,
        recentForm: [],
      };
    })
    .filter((p): p is EspnPlayer => p !== null);
}

/** Fetch live leaderboard for a tournament. */
export async function fetchLeaderboard(tournamentId: string): Promise<{
  entries: EspnLeaderboardEntry[];
  lastCutPosition: number;
}> {
  const res = await fetch(
    `${ESPN_BASE}/leaderboard?event=${tournamentId}`,
    { next: { revalidate: 120 } }
  );
  if (!res.ok) return { entries: [], lastCutPosition: 0 };
  const data = await res.json() as { events?: RawEvent[] };
  const event = data.events?.find((e) => e.id === tournamentId) ?? data.events?.[0];
  const competitors = event?.competitions?.[0]?.competitors ?? [];

  const entries: EspnLeaderboardEntry[] = competitors
    .map((c: RawCompetitor): EspnLeaderboardEntry | null => {
      const id = c.athlete?.id ?? c.id;
      if (!id) return null;
      const statusName = c.status?.type?.name;
      const posVal = c.status?.position?.value;
      return {
        playerId: id,
        displayName: c.athlete?.displayName ?? "Unknown",
        position: typeof posVal === "number" ? posVal : null,
        positionDisplay: c.status?.position?.displayValue ?? "-",
        status: parsePlayerStatus(statusName),
        score: typeof c.score?.value === "number" ? c.score.value : null,
        worldRanking: 999,
      };
    })
    .filter((e): e is EspnLeaderboardEntry => e !== null);

  // Find the last position that made the cut
  const madeCut = entries
    .filter((e) => e.status === "active" || e.status === "complete")
    .map((e) => e.position ?? 0);
  const lastCutPosition = madeCut.length > 0 ? Math.max(...madeCut) : 0;

  return { entries, lastCutPosition };
}
