import { NextRequest, NextResponse } from "next/server";
import { supabase, createServiceClient } from "@/lib/supabase";
import { fetchTournamentPair, fetchEurTournamentPair } from "@/lib/espn";
import { deriveCompStatus, type DerivedCompStatus } from "@/lib/status";

interface Props {
  params: Promise<{ code: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { code } = await params;

  const { data: initialComp, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("join_code", code.toUpperCase())
    .single();

  if (error || !initialComp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let comp = initialComp;
  const isEur = comp.tournament_tour === "eur";
  const fetchPair = isEur ? fetchEurTournamentPair : fetchTournamentPair;

  // When a group exists but no tournament was announced yet, check ESPN on every
  // page load (responses are cached for 10 min). As soon as a "pre" tournament
  // appears we link it to the group and flip status to "open".
  let tournamentPair: Awaited<ReturnType<typeof fetchPair>> | null = null;

  if (comp.status === "awaiting_tournament") {
    tournamentPair = await fetchPair();
    const { next } = tournamentPair;
    if (next) {
      const teeTime = next.firstTeeTime ?? next.startDate;
      const pickDeadline = new Date(
        new Date(teeTime).getTime() - 30 * 60 * 1000
      ).toISOString();
      const db = createServiceClient();
      const { data: updated } = await db
        .from("competitions")
        .update({
          tournament_espn_id:    next.id,
          tournament_name:       next.name,
          tournament_start_date: next.startDate,
          tournament_tour:       next.tour,
          pick_deadline:         pickDeadline,
          status:                "open",
        })
        .eq("id", comp.id)
        .select()
        .single();
      if (updated) comp = updated;
    }
  }

  // Derive effective status from live ESPN data rather than the DB status field.
  // The DB status is only authoritative for awaiting_tournament (no tournament linked).
  let derivedStatus: DerivedCompStatus = "awaiting_tournament";
  if (comp.tournament_espn_id) {
    if (!tournamentPair) tournamentPair = await fetchPair();
    const linked = [tournamentPair.inPlay, tournamentPair.next, tournamentPair.past]
      .find((t) => t?.id === comp.tournament_espn_id);
    // If not in the rolling 30-day window the tournament is over
    const espnStatus = linked?.status ?? "post";
    const hasPlayers = linked?.fieldReady ?? false;
    derivedStatus = deriveCompStatus(espnStatus, hasPlayers);
  }

  return NextResponse.json({ competition: comp, derivedStatus });
}
