import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchLeaderboard } from "@/lib/espn";

interface Props {
  params: Promise<{ code: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { code } = await params;
  const sessionToken = req.headers.get("x-session-token");

  const { data: comp } = await supabase
    .from("competitions")
    .select("id, tournament_espn_id, tournament_name, status")
    .eq("join_code", code.toUpperCase())
    .single();

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: participants } = await supabase
    .from("participants")
    .select("id, session_token")
    .eq("competition_id", comp.id);

  const allParticipantIds = (participants ?? []).map((p) => p.id);
  const myParticipantId = sessionToken
    ? (participants ?? []).find((p) => p.session_token === sessionToken)?.id
    : null;

  let allPicks: { participant_id: string; player_espn_id: string }[] = [];
  if (allParticipantIds.length) {
    const { data } = await supabase
      .from("picks")
      .select("participant_id, player_espn_id")
      .in("participant_id", allParticipantIds);
    allPicks = data ?? [];
  }

  const groupPickIds = new Set(allPicks.map((p) => p.player_espn_id));
  const myPickIds = new Set(
    allPicks
      .filter((p) => p.participant_id === myParticipantId)
      .map((p) => p.player_espn_id)
  );

  const { entries } = comp.tournament_espn_id
    ? await fetchLeaderboard(comp.tournament_espn_id)
    : { entries: [] };

  const enrichedEntries = entries.map((e) => ({
    playerId: e.playerId,
    displayName: e.displayName,
    shortName: e.shortName,
    positionDisplay: e.positionDisplay,
    score: e.score,
    thru: e.thru,
    status: e.status,
    pickedByGroup: groupPickIds.has(e.playerId),
    pickedByMe: myPickIds.has(e.playerId),
  }));

  return NextResponse.json({
    tournamentName: comp.tournament_name,
    fieldSize: entries.length,
    entries: enrichedEntries,
    isLive: comp.status === "live",
  });
}
