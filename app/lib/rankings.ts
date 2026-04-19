import { supabase } from "@/lib/supabase";
import type { RankedPlayer } from "@/lib/datagolf";

export async function fetchWorldRankings(): Promise<RankedPlayer[]> {
  const { data, error } = await supabase
    .from("player_rankings")
    .select("player_id, ranking, name, first_name, last_name")
    .order("ranking", { ascending: true });

  if (error || !data || data.length === 0) {
    console.warn("player_rankings table empty or unavailable:", error?.message);
    return [];
  }

  return data.map((r) => ({
    id: r.player_id,
    espnId: null,
    name: r.name,
    worldRanking: r.ranking,
    odds: null,
    recentForm: [],
  }));
}
