import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function computeDeadline(firstTeeTime: string): Date {
  return new Date(new Date(firstTeeTime).getTime() - 30 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    groupName,
    maxPlayers,
    tournamentEspnId,
    tournamentName,
    tournamentStartDate,
    tournamentTour,
    firstTeeTime,
  } = body;

  const db = createServiceClient();

  // Generate a unique join code (retry up to 5 times on collision)
  let joinCode = "";
  for (let i = 0; i < 5; i++) {
    const candidate = generateJoinCode();
    const { data } = await db
      .from("competitions")
      .select("id")
      .eq("join_code", candidate)
      .single();
    if (!data) { joinCode = candidate; break; }
  }
  if (!joinCode) {
    return NextResponse.json({ error: "Could not generate unique code" }, { status: 500 });
  }

  const hasTournament = tournamentEspnId && tournamentName && firstTeeTime;
  const pickDeadline = hasTournament ? computeDeadline(firstTeeTime).toISOString() : null;

  const { data: comp, error } = await db
    .from("competitions")
    .insert({
      join_code:             joinCode,
      tournament_espn_id:    tournamentEspnId ?? null,
      tournament_name:       tournamentName ?? null,
      tournament_start_date: tournamentStartDate ?? null,
      tournament_tour:       tournamentTour === "eur" ? "eur" : "pga",
      pick_deadline:         pickDeadline,
      max_players:           maxPlayers ?? null,
      status:                hasTournament ? "open" : "awaiting_tournament",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ joinCode: comp.join_code, competitionId: comp.id });
}
