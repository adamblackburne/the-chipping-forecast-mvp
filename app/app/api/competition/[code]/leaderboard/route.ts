import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchLeaderboard } from "@/lib/espn";
import { scoreParticipant } from "@/lib/scoring";
import type { PickResult } from "@/lib/scoring";
import { deriveCompStatus } from "@/lib/status";

interface Props {
  params: Promise<{ code: string }>;
}

interface PickDisplay {
  golferId: string;
  golferName: string;
  worldRankAtPick: number;
  currentFinish: string;
}

interface ScoredMember {
  id: string;
  displayName: string;
  isCurrentUser: boolean;
  totalScore: number | null;
  trend: number;
  picks: PickDisplay[];
  tiebreakPositions: number[];
}

function sortMembers(members: ScoredMember[]): ScoredMember[] {
  return [...members].sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0;
    if (a.totalScore === null) return 1;
    if (b.totalScore === null) return -1;
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    for (let i = 0; i < 4; i++) {
      const aPos = a.tiebreakPositions[i] ?? Infinity;
      const bPos = b.tiebreakPositions[i] ?? Infinity;
      if (aPos !== bPos) return aPos - bPos;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function GET(req: NextRequest, { params }: Props) {
  const { code } = await params;
  const sessionToken = req.headers.get("x-session-token");

  const { data: comp } = await supabase
    .from("competitions")
    .select("id, tournament_espn_id, tournament_name, cut_position_snapshot")
    .eq("join_code", code.toUpperCase())
    .single();

  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, session_token")
    .eq("competition_id", comp.id)
    .order("created_at", { ascending: true });

  if (!participants?.length) {
    return NextResponse.json({
      members: [],
      tournamentName: comp.tournament_name,
      tournamentId: comp.tournament_espn_id,
      isLive: false,
    });
  }

  const { data: allPicks } = await supabase
    .from("picks")
    .select("participant_id, pick_slot, player_espn_id, player_name, world_ranking_at_pick")
    .in("participant_id", participants.map((p) => p.id))
    .order("pick_slot", { ascending: true });

  const { entries, lastCutPosition: liveCutPosition, currentRound, espnStatus } = comp.tournament_espn_id
    ? await fetchLeaderboard(comp.tournament_espn_id)
    : { entries: [], lastCutPosition: 0, currentRound: 0, espnStatus: "pre" as const };

  // Determine the cut penalty baseline (pickScore adds +1 to this).
  // Pre-cut (R1/R2): projected cut = half the field, so penalty = floor(fieldSize/2) + 1.
  // Post-cut (R3+): snapshot the position of the last player to make the cut and freeze it.
  let lastCutPosition: number;
  if (comp.cut_position_snapshot !== null) {
    lastCutPosition = comp.cut_position_snapshot;
  } else if (currentRound >= 3 && liveCutPosition > 0) {
    lastCutPosition = liveCutPosition;
    await supabase
      .from("competitions")
      .update({ cut_position_snapshot: liveCutPosition })
      .eq("id", comp.id);
  } else {
    lastCutPosition = Math.floor(entries.length / 2);
  }

  const entryMap = new Map(entries.map((e) => [e.playerId, e]));

  const scored: ScoredMember[] = participants.map((p) => {
    const myPicks = (allPicks ?? []).filter((pk) => pk.participant_id === p.id);

    const pickResults: PickResult[] = myPicks.map((pk) => {
      const entry = entryMap.get(pk.player_espn_id);
      return {
        slot: pk.pick_slot as 1 | 2 | 3 | 4,
        playerName: pk.player_name,
        position: entry?.position ?? null,
        status: entry?.status ?? "active",
      };
    });

    const { total, tiebreakPositions } = scoreParticipant(pickResults, lastCutPosition);

    const picks: PickDisplay[] = myPicks.map((pk) => {
      const entry = entryMap.get(pk.player_espn_id);
      let currentFinish = "–";
      if (entry) {
        if (entry.status === "cut") currentFinish = "CUT";
        else if (entry.status === "wd") currentFinish = "WD";
        else if (entry.status === "dq") currentFinish = "DQ";
        else currentFinish = entry.positionDisplay;
      }
      return {
        golferId: pk.player_espn_id,
        golferName: pk.player_name,
        worldRankAtPick: pk.world_ranking_at_pick,
        currentFinish,
      };
    });

    return {
      id: p.id,
      displayName: p.display_name,
      isCurrentUser: sessionToken ? p.session_token === sessionToken : false,
      totalScore: total,
      trend: 0,
      picks,
      tiebreakPositions,
    };
  });

  const sorted = sortMembers(scored);

  const members = sorted.map(({ id, displayName, isCurrentUser, totalScore, trend, picks }) => ({
    id,
    displayName,
    isCurrentUser,
    totalScore,
    trend,
    picks,
  }));

  const derivedStatus = deriveCompStatus(espnStatus, entries.length > 0);
  const picksLocked = derivedStatus === "in_progress" || derivedStatus === "final";

  // Before picks are locked, hide other participants' picks and scores.
  const membersOut = picksLocked
    ? members
    : members.map((m) =>
        m.isCurrentUser ? m : { ...m, picks: [], totalScore: null, trend: 0 }
      );

  return NextResponse.json({
    members: membersOut,
    tournamentName: comp.tournament_name,
    tournamentId: comp.tournament_espn_id,
    isLive: derivedStatus === "in_progress",
    isFinal: derivedStatus === "final",
    picksLocked,
  });
}
