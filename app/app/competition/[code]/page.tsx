"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { CountdownTimer } from "@/components/competition/CountdownTimer";
import { PickSummary, type PickSummaryItem } from "@/components/competition/PickSummary";
import { ParticipantList, type ParticipantStatus } from "@/components/competition/ParticipantList";
import { Divider } from "@/components/ui/Divider";
import { getSession, hydrateFromToken } from "@/lib/session";

interface Props {
  params: Promise<{ code: string }>;
}

export default function CompetitionPage({ params }: Props) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const upperCode = code.toUpperCase();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickSummaryItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [deadlineLabel, setDeadlineLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [awaitingTournament, setAwaitingTournament] = useState(false);
  const [fieldAvailable, setFieldAvailable] = useState(false);
  const [picksLocked, setPicksLocked] = useState(false);

  // Handle ?t= personal link token
  useEffect(() => {
    const t = searchParams.get("t");
    if (t) {
      hydrateFromToken(t, upperCode);
      // Clean URL
      router.replace(`/competition/${upperCode}`);
    }
    const session = getSession();
    if (!session) {
      router.replace(`/join/${upperCode}`);
      return;
    }
    setSessionToken(session.sessionToken);
  }, [router, searchParams, upperCode]);

  const load = useCallback(async (token: string) => {
    try {
      const [compRes, picksRes, partRes] = await Promise.all([
        fetch(`/api/competition/${upperCode}`),
        fetch(`/api/picks?code=${upperCode}`, { headers: { "x-session-token": token } }),
        fetch(`/api/competition/${upperCode}/participants`, { headers: { "x-session-token": token } }),
      ]);
      const compData = await compRes.json();
      const picksData = await picksRes.json();
      const partData = await partRes.json();

      const ds: string = compData.derivedStatus ?? "awaiting_tournament";
      setAwaitingTournament(ds === "awaiting_tournament");
      setFieldAvailable(ds === "open");
      setPicksLocked(ds === "in_progress" || ds === "final");

      if (ds !== "awaiting_tournament" && compData.competition?.pick_deadline) {
        const dl = new Date(compData.competition.pick_deadline);
        setDeadline(dl);
        setDeadlineLabel(
          dl.toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          })
        );
        setRevealed(new Date() >= dl);
      }

      setPicks(
        (picksData.picks ?? []).map((p: { pick_slot: 1|2|3|4; player_name: string; world_ranking_at_pick: number; final_position?: number | null }) => ({
          slot: p.pick_slot,
          playerName: p.player_name,
          worldRanking: p.world_ranking_at_pick,
          finalPosition: p.final_position,
        }))
      );
      setParticipants(partData.participants ?? []);
      setCurrentParticipantId(partData.currentParticipantId ?? null);
    } catch {
      // Silently handle — user will see empty state
    } finally {
      setLoading(false);
    }
  }, [upperCode]);

  useEffect(() => {
    if (sessionToken) load(sessionToken);
  }, [sessionToken, load]);

  async function handleShare() {
    const session = getSession();
    if (!session) return;
    const url = `${window.location.origin}/competition/${upperCode}`;
    const text = `Join my Chipping Forecast group! Code: ${upperCode}\n${url}`;
    if (navigator.share) {
      await navigator.share({ title: "Join my group", text, url });
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  const hasPicks = picks.length === 4;
  const isPastDeadline = deadline ? new Date() >= deadline : false;

  return (
    <MobileShell>
      <TopBar
        title={revealed ? "Leaderboard" : "You're in"}
        action={
          <button
            onClick={handleShare}
            className="text-sm text-accent font-medium"
          >
            Invite
          </button>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex flex-col flex-1 px-5 py-5 gap-5 overflow-y-auto">
          {/* Awaiting tournament / Countdown / Revealed state */}
          {awaitingTournament ? (
            <div className="rounded-xl border border-line-soft bg-paper-2 px-4 py-4 text-center space-y-1">
              <p className="font-display font-bold text-lg text-ink">Waiting for next tournament</p>
              <p className="font-sans text-xs text-ink-2">
                Picks will open automatically once the schedule is announced. Check back soon.
              </p>
            </div>
          ) : !revealed && deadline ? (
            <div className="text-center space-y-1">
              <p className="font-sans text-sm text-ink-2">Picks reveal in</p>
              <CountdownTimer
                targetDate={deadline}
                onExpire={() => setRevealed(true)}
              />
              <p className="font-sans text-xs text-ink-3 mt-1">
                until {deadlineLabel}
              </p>
            </div>
          ) : (
            <div className="bg-accent-soft rounded-xl p-4 text-center">
              <p className="font-display font-bold text-xl text-ink">Picks revealed!</p>
              <p className="font-sans text-xs text-ink-2 mt-1">
                The tournament is underway.
              </p>
            </div>
          )}

          <Divider />

          {/* User's picks — hidden until tournament is announced */}
          {!awaitingTournament && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
                  {revealed ? "Your picks" : "Your 4 (hidden from others)"}
                </span>
              </div>
            </div>

            {hasPicks ? (
              <PickSummary
                picks={picks}
                onEdit={!isPastDeadline ? () => router.push(`/competition/${upperCode}/picks`) : undefined}
              />
            ) : fieldAvailable ? (
              <Link href={`/competition/${upperCode}/picks`}>
                <Button variant="accent" full>
                  Make your picks →
                </Button>
              </Link>
            ) : picksLocked ? (
              <div className="rounded-xl border border-line-soft bg-paper-2 px-4 py-4 text-center space-y-1">
                <p className="font-display font-semibold text-base text-ink">Picks are locked</p>
                <p className="font-sans text-xs text-ink-2">
                  The tournament is underway. No picks were made for this competition.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-line-soft bg-paper-2 px-4 py-4 text-center space-y-1">
                <p className="font-display font-semibold text-base text-ink">Picks not open yet</p>
                <p className="font-sans text-xs text-ink-2">
                  The field hasn&apos;t been confirmed. Picks will open closer to the tournament.
                </p>
              </div>
            )}
          </div>
          )}

          <Divider />

          {/* Group status */}
          <ParticipantList
            participants={participants}
            currentParticipantId={currentParticipantId ?? undefined}
          />

          {/* Invite button */}
          <div className="mt-auto pt-2">
            <Button variant="ghost" full onClick={handleShare}>
              Share invite code: {upperCode}
            </Button>
          </div>
        </main>
      )}

      <TabBar competitionCode={upperCode} />
    </MobileShell>
  );
}
