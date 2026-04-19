export interface RankedPlayer {
  id: string;
  espnId: string | null;
  name: string;
  worldRanking: number;
  odds: string | null;
  recentForm: string[];
}

/** Return only players in the specified ranking bracket. */
export function filterByBracket(
  players: RankedPlayer[],
  slot: 1 | 2 | 3 | 4
): RankedPlayer[] {
  switch (slot) {
    case 1: return players.filter((p) => p.worldRanking >= 1 && p.worldRanking <= 10);
    case 2: return players.filter((p) => p.worldRanking >= 11 && p.worldRanking <= 20);
    case 3: return players.filter((p) => p.worldRanking >= 21 && p.worldRanking <= 30);
    case 4: return players.filter((p) => p.worldRanking >= 31);
  }
}

export function bracketLabel(slot: 1 | 2 | 3 | 4): string {
  switch (slot) {
    case 1: return "Top 10";
    case 2: return "Ranks 11–20";
    case 3: return "Ranks 21–30";
    case 4: return "Ranks 31+";
  }
}

export function validatePickSlot(worldRanking: number, slot: 1 | 2 | 3 | 4): boolean {
  switch (slot) {
    case 1: return worldRanking >= 1 && worldRanking <= 10;
    case 2: return worldRanking >= 11 && worldRanking <= 20;
    case 3: return worldRanking >= 21 && worldRanking <= 30;
    case 4: return worldRanking >= 31;
  }
}
