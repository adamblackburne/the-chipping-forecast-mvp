"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { getSession } from "@/lib/session";

interface PickDisplay {
  golferId: string;
  golferName: string;
  worldRankAtPick: number;
  currentFinish: string;
}

interface GroupMember {
  id: string;
  displayName: string;
  isCurrentUser: boolean;
  totalScore: number | null;
  trend: number;
  picks: PickDisplay[];
}

interface LeaderboardData {
  members: GroupMember[];
  tournamentName: string;
  tournamentId: string | null;
  isLive: boolean;
  picksLocked: boolean;
}

interface LiveTournament {
  id: string;
  name: string;
}

function bestFinish(picks: PickDisplay[]): string {
  let best = Infinity;
  let bestDisplay = "–";
  for (const p of picks) {
    if (["CUT", "WD", "DQ", "–"].includes(p.currentFinish)) continue;
    const num = parseInt(p.currentFinish.replace(/[TF]/, ""), 10);
    if (!isNaN(num) && num < best) {
      best = num;
      bestDisplay = p.currentFinish;
    }
  }
  return bestDisplay;
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [liveTournament, setLiveTournament] = useState<LiveTournament | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace(`/join/${code}`);
      return;
    }

    fetch(`/api/competition/${code}/leaderboard`, {
      headers: { "x-session-token": session.sessionToken },
    })
      .then((r) => r.json())
      .then(async (d: LeaderboardData) => {
        setData(d);
        const me = d.members.find((m) => m.isCurrentUser);
        if (me) setOpenMemberId(me.id);

        // If no tournament linked to this group, check for a live ESPN tournament
        if (!d.tournamentId) {
          const tr = await fetch("/api/tournaments").then((r) => r.json()).catch(() => null);
          if (tr?.inPlay) setLiveTournament({ id: tr.inPlay.id, name: tr.inPlay.name });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, router]);

  function handleRowTap(member: GroupMember) {
    if (!data?.picksLocked && !member.isCurrentUser) return;
    setOpenMemberId((prev) => (prev === member.id ? null : member.id));
  }

  return (
    <MobileShell>
      <TopBar
        title="Leaderboard"
        back={`/competition/${code}`}
        action={
          data?.tournamentId ? (
            <Link
              href={`/competition/${code}/board/field`}
              className="text-sm text-accent font-medium whitespace-nowrap"
            >
              Full field ›
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.members.length ? (
        <main className="flex flex-col flex-1 items-center justify-center px-5 py-8 gap-4">
          <p className="font-display text-2xl font-bold text-ink">No data yet</p>
          <p className="font-sans text-sm text-ink-2 text-center">
            The leaderboard will appear once the tournament is underway and picks are locked.
          </p>
        </main>
      ) : (
        <main className="flex flex-col flex-1 overflow-y-auto">
          {/* Status strip */}
          {data.isLive ? (
            <div className="flex items-center justify-between px-4 py-2 border-b border-line-soft bg-paper-2 shrink-0">
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-600 text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                Live
              </span>
              <span className="font-sans text-[11px] text-ink-3">tap row → see picks</span>
            </div>
          ) : !data.picksLocked ? (
            <div className="px-4 py-2 border-b border-line-soft bg-paper-2 shrink-0">
              <span className="font-sans text-[11px] text-ink-3">Picks are hidden until the tournament begins</span>
            </div>
          ) : null}

          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_3rem_3rem_2.5rem] gap-x-2 px-4 py-2 border-b border-line-soft bg-paper shrink-0">
            <span className="font-mono text-[10px] text-ink-3 text-center">#</span>
            <span className="font-mono text-[10px] text-ink-3">Player ↕</span>
            <span className="font-mono text-[10px] text-ink-3 text-right">Total ↓</span>
            <span className="font-mono text-[10px] text-ink-3 text-right">Best</span>
            <span className="font-mono text-[10px] text-ink-3 text-right">Δ</span>
          </div>

          {/* Member rows */}
          <div>
            {data.members.map((member, idx) => {
              const isOpen = openMemberId === member.id;
              const best = bestFinish(member.picks);
              const canExpand = data.picksLocked || member.isCurrentUser;

              return (
                <div key={member.id}>
                  <button
                    onClick={() => handleRowTap(member)}
                    className={[
                      "w-full grid grid-cols-[2rem_1fr_3rem_3rem_2.5rem] gap-x-2 px-4 py-3 border-b border-line-soft text-left transition-colors",
                      member.isCurrentUser
                        ? "bg-accent-soft"
                        : "bg-paper active:bg-paper-2",
                    ].join(" ")}
                  >
                    {/* Rank */}
                    <span className="font-mono text-sm text-ink-2 text-center self-start pt-0.5">
                      {idx + 1}
                    </span>

                    {/* Name + secondary line */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-sans text-sm font-medium text-ink truncate">
                          {member.displayName}
                          {member.isCurrentUser && (
                            <span className="text-accent font-normal"> (you)</span>
                          )}
                        </span>
                        {canExpand && (
                          <span
                            className={[
                              "text-ink-3 text-base leading-none shrink-0 transition-transform duration-150 inline-block",
                              isOpen ? "rotate-90" : "",
                            ].join(" ")}
                          >
                            ›
                          </span>
                        )}
                      </div>
                      {member.picks.length > 0 && (
                        <span className="font-mono text-[11px] text-ink-3 mt-0.5">
                          {member.picks.map((p, i) => (
                            <span key={p.golferId}>
                              {i > 0 && <span> · </span>}
                              <span
                                className={
                                  ["CUT", "WD", "DQ"].includes(p.currentFinish)
                                    ? "text-warn"
                                    : ""
                                }
                              >
                                {p.currentFinish}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <span className="font-mono text-base font-bold text-ink text-right self-start">
                      {member.totalScore ?? "–"}
                    </span>

                    {/* Best */}
                    <span className="font-mono text-xs text-ink-2 text-right self-start pt-0.5">
                      {best}
                    </span>

                    {/* Trend */}
                    <span
                      className={[
                        "font-mono text-xs text-right self-start pt-0.5",
                        member.trend < 0
                          ? "text-accent"
                          : member.trend > 0
                          ? "text-warn"
                          : "text-ink-3",
                      ].join(" ")}
                    >
                      {member.trend < 0
                        ? `▲${Math.abs(member.trend)}`
                        : member.trend > 0
                        ? `▼${member.trend}`
                        : "–"}
                    </span>
                  </button>

                  {/* Expanded drawer */}
                  {isOpen && member.picks.length > 0 && (
                    <div
                      className={[
                        "border-l-[3px] border-accent border-b border-line-soft",
                        member.isCurrentUser ? "bg-accent-soft" : "bg-paper-2",
                      ].join(" ")}
                    >
                      {member.picks.map((pick) => (
                        <div
                          key={pick.golferId}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-line-soft/50 last:border-b-0"
                        >
                          <span className="font-mono text-[11px] text-ink-3 w-8 shrink-0">
                            #{pick.worldRankAtPick}
                          </span>
                          <span className="font-sans text-sm text-ink flex-1 truncate">
                            {pick.golferName}
                          </span>
                          <span
                            className={[
                              "font-mono text-sm font-medium shrink-0",
                              ["CUT", "WD", "DQ"].includes(pick.currentFinish)
                                ? "text-warn"
                                : "text-ink",
                            ].join(" ")}
                          >
                            {pick.currentFinish}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      )}

      <TabBar competitionCode={code} />
    </MobileShell>
  );
}
