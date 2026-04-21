"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { TierSection } from "@/components/picks/TierSection";
import { PickProgress } from "@/components/picks/PickProgress";
import { getSession } from "@/lib/session";
import { filterByBracket, type RankedPlayer } from "@/lib/datagolf";

interface Props {
  params: Promise<{ code: string }>;
}

interface PlayerWithRank extends RankedPlayer {
  inField: boolean;
}

type Picks = Record<1 | 2 | 3 | 4, RankedPlayer | null>;

const SLOTS = [1, 2, 3, 4] as const;

function firstUnpickedSlot(picks: Picks): 1 | 2 | 3 | 4 | null {
  for (const slot of SLOTS) {
    if (!picks[slot]) return slot;
  }
  return null;
}

export default function PicksPage({ params }: Props) {
  const { code } = use(params);
  const router = useRouter();
  const upperCode = code.toUpperCase();

  const [players, setPlayers] = useState<PlayerWithRank[]>([]);
  const [picks, setPicks] = useState<Picks>({ 1: null, 2: null, 3: null, 4: null });
  const [expandedSlot, setExpandedSlot] = useState<1 | 2 | 3 | 4 | null>(1);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 86400000));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [awaitingTournament, setAwaitingTournament] = useState(false);
  const [fieldScheduled, setFieldScheduled] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session || session.competitionCode !== upperCode) {
      router.replace(`/join/${upperCode}`);
      return;
    }
    setSessionToken(session.sessionToken);
  }, [router, upperCode]);

  useEffect(() => {
    if (!sessionToken) return;
    async function load() {
      try {
        const [playersRes, competitionRes, existingPicksRes] = await Promise.all([
          fetch(`/api/players?code=${upperCode}`),
          fetch(`/api/competition/${upperCode}`),
          fetch(`/api/picks?code=${upperCode}`, {
            headers: { "x-session-token": sessionToken! },
          }),
        ]);
        const playersData = await playersRes.json();
        const compData = await competitionRes.json();
        const picksData = await existingPicksRes.json();

        if (compData.competition?.status === "awaiting_tournament") {
          setAwaitingTournament(true);
          return;
        }
        const loadedPlayers = playersData.players ?? [];
        if (loadedPlayers.length === 0) {
          setFieldScheduled(true);
          return;
        }
        setPlayers(loadedPlayers);
        if (compData.competition?.pick_deadline) {
          setDeadline(new Date(compData.competition.pick_deadline));
        }
        // Restore existing picks
        if (picksData.picks) {
          const restored: Picks = { 1: null, 2: null, 3: null, 4: null };
          for (const p of picksData.picks) {
            const player = (playersData.players ?? []).find(
              (pl: RankedPlayer) => pl.id === p.player_espn_id
            );
            if (player && p.pick_slot >= 1 && p.pick_slot <= 4) {
              restored[p.pick_slot as 1 | 2 | 3 | 4] = player;
            }
          }
          setPicks(restored);
          setExpandedSlot(firstUnpickedSlot(restored));
        }
      } catch {
        setError("Failed to load player data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionToken, upperCode]);

  const handleSelect = useCallback(async (slot: 1 | 2 | 3 | 4, player: RankedPlayer) => {
    setPicks((prev) => {
      const next = { ...prev, [slot]: player };
      const nextOpen = firstUnpickedSlot(next);
      setExpandedSlot(nextOpen);
      return next;
    });

    if (!sessionToken) return;
    try {
      await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify({
          joinCode: upperCode,
          pickSlot: slot,
          playerEspnId: player.id,
          playerName: player.name,
          worldRanking: player.worldRanking,
        }),
      });
    } catch {
      // Silently ignore — pick is stored locally until page refresh confirms
    }
  }, [sessionToken, upperCode]);

  async function handleSubmit() {
    const allFilled = SLOTS.every((s) => picks[s] !== null);
    if (!allFilled) {
      setError("Please pick one golfer from each tier");
      return;
    }
    setSaving(true);
    router.push(`/competition/${upperCode}`);
  }

  const pickCount = Object.values(picks).filter(Boolean).length;
  const isPastDeadline = new Date() >= deadline;
  const allPicked = pickCount === 4;

  return (
    <MobileShell>
      <TopBar
        back={`/competition/${upperCode}`}
        title={isPastDeadline ? "Your picks" : "Make picks"}
        action={<PickProgress count={pickCount} />}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : awaitingTournament ? (
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="text-center space-y-2">
            <p className="font-display font-bold text-xl text-ink">No tournament yet</p>
            <p className="font-sans text-sm text-ink-2">
              Picks will open once the next tournament is announced. Check back soon.
            </p>
          </div>
        </div>
      ) : fieldScheduled ? (
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="text-center space-y-2">
            <p className="font-display font-bold text-xl text-ink">Tournament upcoming</p>
            <p className="font-sans text-sm text-ink-2">
              Picks will open once the field is confirmed. Check back closer to the tournament.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {SLOTS.map((slot) => {
              const tierPlayers = filterByBracket(players, slot);
              return (
                <TierSection
                  key={slot}
                  slot={slot}
                  players={tierPlayers}
                  selectedPlayer={picks[slot]}
                  onSelect={(player) => handleSelect(slot, player)}
                  deadline={deadline}
                  isExpanded={expandedSlot === slot}
                  onToggleExpand={() =>
                    setExpandedSlot((prev) => (prev === slot ? null : slot))
                  }
                />
              );
            })}
          </div>

          {!isPastDeadline && (
            <div className="px-4 py-3 border-t border-line-soft bg-paper-2 shrink-0">
              {error && <p className="text-xs text-warn mb-2 text-center">{error}</p>}
              <Button
                variant="accent"
                full
                size="lg"
                onClick={handleSubmit}
                disabled={saving || !allPicked}
              >
                {allPicked ? "Lock in picks →" : `Pick all 4 to continue (${pickCount}/4)`}
              </Button>
            </div>
          )}
        </>
      )}
    </MobileShell>
  );
}
