import { NextRequest, NextResponse } from "next/server";
import { fetchWorldRankings } from "@/lib/datagolf";
import { fetchTournamentField } from "@/lib/espn";
import { supabase } from "@/lib/supabase";
import type { RankedPlayer } from "@/lib/datagolf";

export const revalidate = 3600; // Rankings update weekly

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Get the tournament for this competition
  const { data: comp } = await supabase
    .from("competitions")
    .select("tournament_espn_id")
    .eq("join_code", code.toUpperCase())
    .single();

  if (!comp) return NextResponse.json({ players: [] });

  const [rankings, fieldPlayers] = await Promise.all([
    fetchWorldRankings(),
    fetchTournamentField(comp.tournament_espn_id),
  ]);

  // Merge field with rankings — only show players actually in the tournament field
  const fieldIds = new Set(fieldPlayers.map((p) => p.id));
  const fieldEspnNames = new Set(fieldPlayers.map((p) => p.displayName.toLowerCase()));

  let merged: RankedPlayer[];

  if (rankings.length > 0) {
    // DataGolf available — filter to field players, enrich with ESPN odds/form
    merged = rankings
      .filter((r) => {
        if (r.espnId && fieldIds.has(r.espnId)) return true;
        // Fallback: name match
        return fieldEspnNames.has(r.name.toLowerCase());
      })
      .map((r) => {
        const espnPlayer = fieldPlayers.find(
          (p) => p.id === r.espnId || p.displayName.toLowerCase() === r.name.toLowerCase()
        );
        return {
          ...r,
          id: r.espnId ?? r.id,
          odds: espnPlayer?.odds ?? r.odds,
          recentForm: espnPlayer?.recentForm ?? r.recentForm,
        };
      });
  } else {
    // DataGolf unavailable — use ESPN field with placeholder rankings
    // For mock tournaments assign sequential rankings so all brackets are populated
    const isMock = comp.tournament_espn_id === "mock-tournament";
    merged = fieldPlayers.map((p, i) => ({
      id: p.id,
      espnId: p.id,
      name: p.displayName,
      worldRanking: isMock ? i + 1 : p.worldRanking,
      odds: p.odds,
      recentForm: p.recentForm,
    }));
  }

  return NextResponse.json({ players: merged });
}
