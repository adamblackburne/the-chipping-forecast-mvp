import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ code: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { code } = await params;

  const { data: comp } = await supabase
    .from("competitions")
    .select("id")
    .eq("join_code", code.toUpperCase())
    .single();

  if (!comp) return NextResponse.json({ participants: [] });

  const sessionToken = req.headers.get("x-session-token");
  let currentParticipantId: string | null = null;
  if (sessionToken) {
    const { data: self } = await supabase
      .from("participants")
      .select("id")
      .eq("session_token", sessionToken)
      .eq("competition_id", comp.id)
      .single();
    currentParticipantId = self?.id ?? null;
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, created_at")
    .eq("competition_id", comp.id)
    .order("created_at", { ascending: true });

  // Count picks per participant to determine completion
  const result = await Promise.all(
    (participants ?? []).map(async (p: { id: string; display_name: string }) => {
      const { count } = await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", p.id);
      return {
        id: p.id,
        displayName: p.display_name,
        pickCount: count ?? 0,
        picksComplete: (count ?? 0) >= 4,
      };
    })
  );

  return NextResponse.json({ participants: result, currentParticipantId });
}
