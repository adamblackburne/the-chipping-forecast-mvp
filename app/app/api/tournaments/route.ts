import { NextResponse } from "next/server";
import { fetchTournamentPair } from "@/lib/espn";

export const revalidate = 600;

export async function GET() {
  const { inPlay, next } = await fetchTournamentPair();
  return NextResponse.json({ inPlay, next, tournament: next ?? inPlay });
}
