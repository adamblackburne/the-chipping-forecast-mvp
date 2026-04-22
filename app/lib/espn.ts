const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";
const ESPN_WEB_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/golf";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";
const ESPN_TOURSCHEDULE = "https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/tourschedule";
const ESPN_EUR_TOURSCHEDULE = `${ESPN_WEB_BASE}/eur/tourschedule`;
const ESPN_EUR_LEADERBOARD_BASE = `${ESPN_WEB_BASE}/leaderboard?league=eur&region=gb&lang=en`;

export interface EspnTournament {
  id: string;
  name: string;
  shortName: string;
  startDate: string;   // ISO string
  endDate: string;
  status: "pre" | "in" | "post";
  firstTeeTime: string | null;  // ISO string, null if not yet published
  venue: string;
  fieldReady: boolean; // true when competitors have been announced
  tour: "pga" | "eur";
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
  shortName: string;        // "F. Last" format
  position: number | null;  // numeric position for scoring (e.g. 11 for T11)
  positionDisplay: string;  // "T12", "CUT", "WD", "DQ", etc.
  status: "active" | "cut" | "wd" | "dq" | "complete";
  score: number | null;     // score to par (e.g. -9, 0, +2)
  thru: string | null;      // holes completed: "F", "12", etc.
  teeTime: string | null;   // ISO string, null once round is underway
  startHole: number | null;
  worldRanking: number;
}

interface RawScheduleEvent {
  id: string;
  label: string;
  startDate: string;
  endDate?: string;
  locations?: string[];
  fullStatus?: { type?: { state?: string; name?: string } };
  defendingChampion?: { roster?: unknown[] };
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

interface RawLinescore {
  period?: number;
  value?: number | null;
  displayValue?: string;
  linescores?: RawLinescore[];
}

interface RawCompetitor {
  id?: string;
  order?: number;        // scoreboard format: 1-based ranking
  sortOrder?: number;    // leaderboard format
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
  };
  team?: {
    id?: string;
    displayName?: string;
    shortName?: string;
  };
  status?: {
    position?: { id?: string; displayName?: string; isTie?: boolean };
    type?: { name?: string; state?: string; completed?: boolean };
    displayValue?: string;
    displayThru?: string;
    thru?: number;
    period?: number;
    teeTime?: string;
    startHole?: number;
  };
  score?: { value?: number; displayValue?: string } | string;
  linescores?: RawLinescore[];
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
  if (s.includes("CUT") || s.includes("MC") || s.includes("MISSED")) return "cut";
  if (s.includes("WD") || s.includes("WITHDRAW")) return "wd";
  if (s.includes("DQ") || s.includes("DISQUALIF")) return "dq";
  if (s.includes("FINISH") || s.includes("COMPLETE")) return "complete";
  return "active";
}

function parseScoreToPar(displayValue: string | undefined): number | null {
  if (!displayValue) return null;
  if (displayValue === "E") return 0;
  const parsed = parseInt(displayValue, 10);
  return isNaN(parsed) ? null : parsed;
}

/** Fetch the full PGA Tour season schedule. */
export async function fetchFullSchedule(): Promise<EspnTournament[]> {
  const events = await fetchTourSchedule();
  return events.map((e) => adaptTournament(e, false, "pga"));
}

/** Fetch the full DP World Tour season schedule. */
export async function fetchEurFullSchedule(): Promise<EspnTournament[]> {
  const events = await fetchEurTourSchedule();
  return events.map((e) => adaptTournament(e, false, "eur"));
}

/** Fetch the current/upcoming PGA Tour event. */
export async function fetchCurrentTournament(): Promise<EspnTournament | null> {
  const { inPlay, next } = await fetchTournamentPair();
  return next ?? inPlay;
}

function mockPreTournament(competitors: RawCompetitor[] = []): RawEvent {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "mock-tournament",
    name: "Mock Golf Tournament",
    shortName: "Mock Golf",
    date: start,
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: { type: { state: "pre", name: "STATUS_SCHEDULED" } },
    competitions: [{ startDate: start, venue: { fullName: "Mock Golf Club" }, competitors }],
  };
}

function toESPNDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Fetch the full PGA Tour schedule for the current season. */
async function fetchTourSchedule(): Promise<RawEvent[]> {
  const year = new Date().getFullYear();
  const res = await fetch(
    `${ESPN_TOURSCHEDULE}?region=gb&lang=en&season=${year}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json() as {
    currentSeason?: number;
    seasons?: Array<{ year: number; events?: RawScheduleEvent[] }>;
  };
  const currentYear = data.currentSeason ?? year;
  const season = data.seasons?.find(s => s.year === currentYear) ?? data.seasons?.[0];
  const events = (season?.events ?? []).filter(
    (e) => !e.defendingChampion?.roster || e.defendingChampion.roster.length <= 1
  );
  return events.map((e): RawEvent => ({
    id: e.id,
    name: e.label,
    shortName: e.label,
    date: e.startDate,
    endDate: e.endDate,
    status: { type: { state: e.fullStatus?.type?.state, name: e.fullStatus?.type?.name } },
    competitions: [{ venue: { fullName: e.locations?.[0] ?? "" } }],
  }));
}

/** Fetch a rolling 30-day window of events (15 days back, 15 days forward). */
async function fetchSeasonEvents(): Promise<RawEvent[]> {
  const now = new Date();
  const startDate = new Date(now); startDate.setDate(now.getDate() - 15);
  const endDate = new Date(now); endDate.setDate(now.getDate() + 15);
  const start = toESPNDate(startDate);
  const end = toESPNDate(endDate);
  const res = await fetch(
    `${ESPN_SCOREBOARD}?dates=${start}-${end}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { events?: RawEvent[] };
  return data.events ?? [];
}

export async function fetchTournamentPair(): Promise<{
  inPlay: EspnTournament | null;
  next: EspnTournament | null;
  past: EspnTournament | null;
}> {
  // Phase 1: full season calendar to identify which events we care about
  const seasonEvents = await fetchTourSchedule();

  const inPlayRaw = seasonEvents.find((e) => parseStatus(e.status?.type?.state) === "in") ?? null;
  let upcomingRaw = seasonEvents
    .filter((e) => parseStatus(e.status?.type?.state) === "pre")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  const pastRaw = seasonEvents
    .filter((e) => parseStatus(e.status?.type?.state) === "post")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

  // Phase 2: fetch leaderboard for active event (venue) + upcoming event (field check) in parallel
  const fetchLeaderboardEvent = async (id?: string): Promise<RawEvent | undefined> => {
    const url = id ? `${ESPN_BASE}/leaderboard?event=${id}` : `${ESPN_BASE}/leaderboard`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return undefined;
    const data = await res.json() as { events?: RawEvent[] };
    return data.events?.[0];
  };

  const [activeLeaderboard, upcomingLeaderboard_] = await Promise.all([
    fetchLeaderboardEvent(inPlayRaw?.id),
    upcomingRaw ? fetchLeaderboardEvent(upcomingRaw.id) : Promise.resolve(undefined),
  ]);

  let upcomingLeaderboard = upcomingLeaderboard_;
  if (process.env.MOCK_NEXT_TOURNAMENT === "1") {
    const realCompetitors = activeLeaderboard?.competitions?.[0]?.competitors ?? [];
    upcomingRaw = mockPreTournament(realCompetitors);
    upcomingLeaderboard = undefined;
  }

  // Enrich season event with leaderboard data (competitors), preserving schedule venue
  const enrich = (raw: RawEvent, lb?: RawEvent): RawEvent => {
    if (!lb) return raw;
    const scheduleVenue = raw.competitions?.[0]?.venue?.fullName;
    const lbComp = lb.competitions?.[0];
    const mergedVenue = lbComp?.venue?.fullName || scheduleVenue || "";
    return {
      ...raw,
      competitions: [{ ...lbComp, venue: { fullName: mergedVenue } }, ...(lb.competitions?.slice(1) ?? [])],
    };
  };

  const upcomingCompetitors = (upcomingLeaderboard ?? upcomingRaw)?.competitions?.[0]?.competitors ?? [];
  const fieldReady = upcomingCompetitors.length > 0;

  const inPlay = inPlayRaw ? adaptTournament(enrich(inPlayRaw, activeLeaderboard), true, "pga") : null;
  const upcoming = upcomingRaw ? adaptTournament(enrich(upcomingRaw, upcomingLeaderboard), fieldReady, "pga") : null;
  const past = pastRaw ? adaptTournament(pastRaw, true, "pga") : null;

  // next: for pick flows — live first, then upcoming, then off-season fallback to past
  const next = inPlay ?? upcoming ?? past;

  return { inPlay, next, past };
}

/** Fetch the full DP World Tour schedule for the current season. */
async function fetchEurTourSchedule(): Promise<RawEvent[]> {
  const year = new Date().getFullYear();
  const res = await fetch(
    `${ESPN_EUR_TOURSCHEDULE}?region=gb&lang=en&season=${year}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json() as {
    currentSeason?: number;
    seasons?: Array<{ year: number; events?: RawScheduleEvent[] }>;
  };
  const currentYear = data.currentSeason ?? year;
  const season = data.seasons?.find(s => s.year === currentYear) ?? data.seasons?.[0];
  const events = (season?.events ?? []).filter(
    (e) => !e.defendingChampion?.roster || e.defendingChampion.roster.length <= 1
  );
  return events.map((e): RawEvent => ({
    id: e.id,
    name: e.label,
    shortName: e.label,
    date: e.startDate,
    endDate: e.endDate,
    status: { type: { state: e.fullStatus?.type?.state, name: e.fullStatus?.type?.name } },
    competitions: [{ venue: { fullName: e.locations?.[0] ?? "" } }],
  }));
}

export async function fetchEurTournamentPair(): Promise<{
  inPlay: EspnTournament | null;
  next: EspnTournament | null;
  past: EspnTournament | null;
}> {
  const seasonEvents = await fetchEurTourSchedule();

  const inPlayRaw = seasonEvents.find((e) => parseStatus(e.status?.type?.state) === "in") ?? null;
  const upcomingRaw = seasonEvents
    .filter((e) => parseStatus(e.status?.type?.state) === "pre")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  const pastRaw = seasonEvents
    .filter((e) => parseStatus(e.status?.type?.state) === "post")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

  const fetchEurLeaderboardEvent = async (id?: string): Promise<RawEvent | undefined> => {
    const url = id ? `${ESPN_EUR_LEADERBOARD_BASE}&event=${id}` : ESPN_EUR_LEADERBOARD_BASE;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return undefined;
    const data = await res.json() as { events?: RawEvent[] };
    return data.events?.[0];
  };

  const [activeLeaderboard, upcomingLeaderboard] = await Promise.all([
    fetchEurLeaderboardEvent(inPlayRaw?.id),
    upcomingRaw ? fetchEurLeaderboardEvent(upcomingRaw.id) : Promise.resolve(undefined),
  ]);

  const enrich = (raw: RawEvent, lb?: RawEvent): RawEvent => {
    if (!lb) return raw;
    const scheduleVenue = raw.competitions?.[0]?.venue?.fullName;
    const lbComp = lb.competitions?.[0];
    const mergedVenue = lbComp?.venue?.fullName || scheduleVenue || "";
    return {
      ...raw,
      competitions: [{ ...lbComp, venue: { fullName: mergedVenue } }, ...(lb.competitions?.slice(1) ?? [])],
    };
  };

  const upcomingCompetitors = (upcomingLeaderboard ?? upcomingRaw)?.competitions?.[0]?.competitors ?? [];
  const fieldReady = upcomingCompetitors.length > 0;

  const inPlay = inPlayRaw ? adaptTournament(enrich(inPlayRaw, activeLeaderboard), true, "eur") : null;
  const upcoming = upcomingRaw ? adaptTournament(enrich(upcomingRaw, upcomingLeaderboard), fieldReady, "eur") : null;
  const past = pastRaw ? adaptTournament(pastRaw, true, "eur") : null;

  const next = inPlay ?? upcoming ?? past;
  return { inPlay, next, past };
}

function earliestTeeTime(competitors: RawCompetitor[]): string | null {
  const times = competitors
    .map((c) => c.status?.teeTime)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
    .filter((ms) => !isNaN(ms));
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString();
}

function adaptTournament(e: RawEvent, fieldReady = true, tour: "pga" | "eur" = "pga"): EspnTournament {
  const comp = e.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  return {
    id: e.id,
    name: e.name,
    shortName: e.shortName ?? e.name,
    startDate: e.date,
    endDate: e.endDate ?? e.date,
    status: parseStatus(e.status?.type?.state),
    firstTeeTime: earliestTeeTime(competitors) ?? comp?.startDate ?? null,
    venue: comp?.venue?.fullName ?? "",
    fieldReady,
    tour,
  };
}

/** Fetch field (players) for a tournament. */
export async function fetchTournamentField(tournamentId: string, tour: "pga" | "eur" = "pga"): Promise<EspnPlayer[]> {
  // EUR leaderboard always returns the current week's event without an event ID.
  // PGA uses the event ID to target a specific tournament.
  // Mock tournament has no real ESPN event — fall back to generic leaderboard.
  let url: string;
  if (tournamentId === "mock-tournament") {
    url = `${ESPN_BASE}/leaderboard`;
  } else if (tour === "eur") {
    url = `${ESPN_BASE}/leaderboard?league=eur&region=gb&lang=en`;
  } else {
    url = `${ESPN_BASE}/leaderboard?event=${tournamentId}`;
  }
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = await res.json() as { events?: RawEvent[] };
  const event = data.events?.find((e) => e.id === tournamentId) ?? data.events?.[0];
  const competitors = event?.competitions?.[0]?.competitors ?? [];

  // Team events (e.g. Zurich Classic) have team competitors — unsupported, return empty
  const isTeamEvent = competitors.length > 0 && competitors.every((c) => !c.athlete && c.team);
  if (isTeamEvent) return [];

  return competitors
    .map((c: RawCompetitor): EspnPlayer | null => {
      const id = c.athlete?.id ?? c.team?.id ?? c.id;
      if (!id) return null;
      return {
        id,
        displayName: c.athlete?.displayName ?? c.team?.displayName ?? "Unknown",
        shortName: c.athlete?.shortName ?? c.team?.shortName ?? "",
        worldRanking: 999, // ESPN doesn't reliably expose ranking; DataGolf fills this
        odds: null,
        recentForm: [],
      };
    })
    .filter((p): p is EspnPlayer => p !== null);
}

function getScoreDisplayValue(score: RawCompetitor["score"]): string | undefined {
  if (!score) return undefined;
  if (typeof score === "string") return score;
  return score.displayValue;
}

function detectPlayoff(competitors: RawCompetitor[]): {
  winner: { displayName: string; shortName: string } | null;
  losers: { displayName: string; shortName: string }[];
} {
  let winner: { displayName: string; shortName: string } | null = null;
  const losers: { displayName: string; shortName: string }[] = [];
  for (const c of competitors) {
    const ls5 = c.linescores?.find((ls) => ls.period === 5);
    if (!ls5) continue;
    const player = { displayName: c.athlete?.displayName ?? "Unknown", shortName: c.athlete?.shortName ?? "" };
    if ((ls5.linescores?.length ?? 0) > 0) {
      winner = player;
    } else {
      losers.push(player);
    }
  }
  return { winner, losers };
}

/** Fetch live leaderboard for a tournament. */
export async function fetchLeaderboard(tournamentId: string, isFinal = false): Promise<{
  entries: EspnLeaderboardEntry[];
  lastCutPosition: number;
  currentRound: number;
  playoff: { winner: { displayName: string; shortName: string }; losers: { displayName: string; shortName: string }[] } | null;
  espnStatus: "pre" | "in" | "post";
}> {
  const res = await fetch(
    `${ESPN_BASE}/leaderboard?event=${tournamentId}`,
    isFinal ? { cache: "no-store" } : { next: { revalidate: 120 } }
  );

  if (!res.ok) {
    // Leaderboard endpoint unavailable for past tournaments — fall back to scoreboard
    return fetchLeaderboardFromScoreboard(tournamentId);
  }

  const data = await res.json() as { events?: RawEvent[] };
  const event = data.events?.find((e) => e.id === tournamentId) ?? data.events?.[0];
  const espnStatus = parseStatus(event?.status?.type?.state);
  const competitors = event?.competitions?.[0]?.competitors ?? [];

  const entries: EspnLeaderboardEntry[] = competitors
    .map((c: RawCompetitor): EspnLeaderboardEntry | null => {
      const id = c.athlete?.id ?? c.id;
      if (!id) return null;
      const statusName = c.status?.type?.name;
      const posId = c.status?.position?.id ? parseInt(c.status.position.id, 10) : null;
      const isFinished = c.status?.type?.completed === true || c.status?.displayValue === "F";
      return {
        playerId: id,
        displayName: c.athlete?.displayName ?? "Unknown",
        shortName: c.athlete?.shortName ?? "",
        position: posId !== null && !isNaN(posId) ? posId : null,
        positionDisplay: c.status?.position?.displayName ?? c.status?.displayValue ?? "-",
        status: parsePlayerStatus(statusName),
        score: parseScoreToPar(getScoreDisplayValue(c.score)),
        thru: isFinished ? "F" : (c.status?.displayThru ?? null),
        teeTime: c.status?.teeTime ?? null,
        startHole: c.status?.startHole ?? null,
        worldRanking: 999,
        _sortOrder: c.sortOrder ?? 9999,
      } as EspnLeaderboardEntry & { _sortOrder: number };
    })
    .filter((e): e is EspnLeaderboardEntry => e !== null)
    .sort((a, b) => {
      const sa = (a as EspnLeaderboardEntry & { _sortOrder: number })._sortOrder;
      const sb = (b as EspnLeaderboardEntry & { _sortOrder: number })._sortOrder;
      return sa - sb;
    })
    .map((e) => {
      const { _sortOrder: _, ...entry } = e as EspnLeaderboardEntry & { _sortOrder: number };
      return entry;
    });

  const madeCut = entries
    .filter((e) => e.status === "active" || e.status === "complete")
    .map((e) => e.position ?? 0);
  const lastCutPosition = madeCut.length > 0 ? Math.max(...madeCut) : 0;

  const currentRound = competitors.reduce((max, c) => {
    if (parsePlayerStatus(c.status?.type?.name) === "cut") return max;
    return Math.max(max, c.status?.period ?? 0);
  }, 0);

  const { winner, losers } = detectPlayoff(competitors);
  const playoff = winner ? { winner, losers } : null;

  return { entries, lastCutPosition, currentRound, playoff, espnStatus };
}

async function fetchLeaderboardFromScoreboard(tournamentId: string): Promise<{
  entries: EspnLeaderboardEntry[];
  lastCutPosition: number;
  currentRound: number;
  playoff: { winner: { displayName: string; shortName: string }; losers: { displayName: string; shortName: string }[] } | null;
  espnStatus: "pre" | "in" | "post";
}> {
  const seasonEvents = await fetchSeasonEvents();
  const event = seasonEvents.find((e) => e.id === tournamentId);
  if (!event) return { entries: [], lastCutPosition: 0, currentRound: 0, playoff: null, espnStatus: "post" };

  const competitors = event.competitions?.[0]?.competitors ?? [];

  // Scoreboard format: score is a plain string, status is empty, order is 1-based rank
  const parsed = competitors
    .map((c: RawCompetitor): (EspnLeaderboardEntry & { _order: number }) | null => {
      const id = c.athlete?.id ?? c.id;
      if (!id) return null;
      const scoreStr = getScoreDisplayValue(c.score);
      const score = parseScoreToPar(scoreStr);
      return {
        playerId: id,
        displayName: c.athlete?.displayName ?? "Unknown",
        shortName: c.athlete?.shortName ?? "",
        position: c.order ?? null,
        positionDisplay: "",
        status: "complete",
        score,
        thru: "F",
        teeTime: null,
        startHole: null,
        worldRanking: 999,
        _order: c.order ?? 9999,
      };
    })
    .filter((e): e is EspnLeaderboardEntry & { _order: number } => e !== null)
    .sort((a, b) => a._order - b._order);

  // Compute position display accounting for ties
  let pos = 1;
  let i = 0;
  while (i < parsed.length) {
    const currentScore = parsed[i].score;
    let j = i;
    while (j < parsed.length && parsed[j].score === currentScore) j++;
    const count = j - i;
    const display = count > 1 ? `T${pos}` : `${pos}`;
    for (let k = i; k < j; k++) {
      parsed[k].positionDisplay = display;
      parsed[k].position = pos;
    }
    pos += count;
    i = j;
  }

  const entries = parsed.map(({ _order: _, ...e }) => e);
  const lastCutPosition = parsed.length > 0 ? (parsed[parsed.length - 1].position ?? 0) : 0;

  const { winner, losers } = detectPlayoff(competitors);
  const playoff = winner ? { winner, losers } : null;

  return { entries, lastCutPosition, currentRound: 4, playoff, espnStatus: "post" };
}
