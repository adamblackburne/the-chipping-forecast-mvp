import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface RankingRow {
  player_id: string;
  ranking: number;
  name: string;
  first_name?: string;
  last_name?: string;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rows: RankingRow[];
  try {
    rows = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Expected non-empty array" }, { status: 400 });
  }

  const upsertRows = rows.map((r) => ({
    player_id: String(r.player_id),
    ranking: Number(r.ranking),
    name: String(r.name),
    first_name: r.first_name ? String(r.first_name) : null,
    last_name: r.last_name ? String(r.last_name) : null,
    updated_at: new Date().toISOString(),
  }));

  const db = createServiceClient();
  const { error } = await db
    .from("player_rankings")
    .upsert(upsertRows, { onConflict: "player_id" });

  if (error) {
    console.error("Rankings upsert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: upsertRows.length });
}
