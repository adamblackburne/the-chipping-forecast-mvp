"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { getSession } from "@/lib/session";

interface FieldEntry {
  playerId: string;
  displayName: string;
  shortName: string;
  positionDisplay: string;
  score: number | null;
  thru: string | null;
  status: string;
  pickedByGroup: boolean;
  pickedByMe: boolean;
}

interface FieldData {
  tournamentName: string;
  fieldSize: number;
  entries: FieldEntry[];
  isLive: boolean;
}

type FilterMode = "all" | "group" | "me";

function formatScore(score: number | null): string {
  if (score === null) return "–";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "group", label: "Picked by group" },
  { id: "me", label: "My picks" },
];

export default function FieldPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();

  const [data, setData] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

  useEffect(() => {
    const session = getSession();
    const headers: Record<string, string> = {};
    if (session?.sessionToken) headers["x-session-token"] = session.sessionToken;

    fetch(`/api/competition/${code}/field`, { headers })
      .then((r) => r.json())
      .then((d: FieldData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  const filteredEntries = (data?.entries ?? []).filter((e) => {
    if (filter === "group") return e.pickedByGroup;
    if (filter === "me") return e.pickedByMe;
    return true;
  });

  return (
    <MobileShell>
      <TopBar
        title={data?.tournamentName ?? "Full field"}
        back={`/competition/${code}/board`}
        action={<span className="text-sm text-ink-3 font-medium">Filter</span>}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex flex-col flex-1 overflow-y-auto">
          {/* Event header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft bg-paper-2 shrink-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
              Full field · {data?.fieldSize ?? 0} golfers
            </p>
            {data?.isLive && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-600 text-white shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                Live
              </span>
            )}
          </div>

          {/* Segmented control */}
          <div className="flex border-b border-line-soft shrink-0 bg-paper">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={[
                  "flex-1 py-2.5 font-sans text-[11px] font-medium transition-colors border-b-2",
                  filter === f.id
                    ? "text-ink border-ink"
                    : "text-ink-3 border-transparent",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[3.5rem_1fr_3.5rem_3rem] gap-x-2 px-4 py-2 border-b border-line-soft bg-paper shrink-0">
            <span className="font-mono text-[10px] text-ink-3">Pos</span>
            <span className="font-mono text-[10px] text-ink-3">Player</span>
            <span className="font-mono text-[10px] text-ink-3 text-right">Score</span>
            <span className="font-mono text-[10px] text-ink-3 text-right">Thru</span>
          </div>

          {/* Field rows */}
          <div>
            {filteredEntries.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-sans text-sm text-ink-3">
                  {filter === "all"
                    ? "Awaiting confirmation of field."
                    : "No golfers match this filter."}
                </p>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.playerId}
                  className={[
                    "grid grid-cols-[3.5rem_1fr_3.5rem_3rem] gap-x-2 px-4 py-3 border-b border-line-soft",
                    entry.pickedByGroup ? "bg-accent-soft" : "bg-paper",
                  ].join(" ")}
                >
                  {/* Position */}
                  <span
                    className={[
                      "font-mono text-sm font-bold",
                      entry.status === "cut" || entry.status === "wd" || entry.status === "dq"
                        ? "text-warn"
                        : "text-ink",
                    ].join(" ")}
                  >
                    {entry.positionDisplay}
                  </span>

                  {/* Name + picked chip */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-sans text-sm text-ink truncate">
                      {entry.shortName || entry.displayName}
                    </span>
                    {entry.pickedByGroup && (
                      <span className="shrink-0 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent text-paper leading-tight">
                        picked
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <span
                    className={[
                      "font-mono text-sm text-right",
                      entry.score !== null && entry.score < 0
                        ? "text-warn font-medium"
                        : "text-ink",
                    ].join(" ")}
                  >
                    {formatScore(entry.score)}
                  </span>

                  {/* Thru */}
                  <span className="font-mono text-sm text-ink-3 text-right">
                    {entry.thru ?? "–"}
                  </span>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      <TabBar competitionCode={code} />
    </MobileShell>
  );
}
