"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TournamentBanner } from "@/components/onboarding/TournamentBanner";
import type { EspnTournament } from "@/lib/espn";

export default function CreateGroupPage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("Sunday Sandbaggers");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [tournament, setTournament] = useState<EspnTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((data) => {
        // Always use the next upcoming tournament for picks, never an in-play one
        const t = data.next ?? data.tournament;
        if (t?.status === "in") {
          setError("This tournament has already started. Please wait for the next one.");
        } else {
          setTournament(t);
        }
      })
      .catch(() => setError("Could not load tournament data"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!tournament) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/competition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: groupName.trim() || "Sunday Sandbaggers",
          maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : null,
          tournamentEspnId: tournament.id,
          tournamentName: tournament.name,
          tournamentStartDate: tournament.startDate,
          firstTeeTime: tournament.firstTeeTime ?? tournament.startDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create group");
      router.push(`/setup/${data.joinCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const deadlineDisplay = tournament?.firstTeeTime
    ? formatDeadline(tournament.firstTeeTime)
    : "—";

  return (
    <MobileShell>
      <TopBar back="/" title="New group" />

      <main className="flex flex-col flex-1 px-5 py-5 gap-5 overflow-y-auto">
        <Input
          label="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Sunday Sandbaggers"
        />

        <Input
          label="Max players (optional)"
          type="number"
          inputMode="numeric"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(e.target.value)}
          placeholder="No limit"
          hint="Leave blank for unlimited"
          min="2"
          max="100"
        />

        {/* Tournament info */}
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-2 font-sans mb-1.5">
            Tournament
          </p>
          {loading ? (
            <div className="h-20 rounded-xl bg-paper-2 animate-pulse" />
          ) : tournament ? (
            <TournamentBanner
              name={tournament.name}
              venue={tournament.venue}
              deadlineDisplay={deadlineDisplay}
              status={tournament.status}
            />
          ) : (
            <p className="text-sm text-warn">Could not load tournament</p>
          )}
        </div>

        {error && <p className="text-sm text-warn">{error}</p>}

        <div className="mt-auto pt-4">
          <Button
            variant="accent"
            full
            size="lg"
            onClick={handleCreate}
            disabled={submitting || loading || !tournament}
          >
            {submitting ? "Creating…" : "Create group →"}
          </Button>
        </div>
      </main>
    </MobileShell>
  );
}

function formatDeadline(teeTime: string): string {
  const deadline = new Date(new Date(teeTime).getTime() - 60 * 60 * 1000);
  return deadline.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
