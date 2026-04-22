import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { fetchTournamentPair } from "@/lib/espn";

export const revalidate = 600;

export default async function LandingPage() {
  const { inPlay, next, past } = await fetchTournamentPair().catch(() => ({ inPlay: null, next: null, past: null }));

  // "current" is whatever the user should be acting on right now
  const current = inPlay ?? next;
  const deadlineDisplay = current?.firstTeeTime && current.status === "pre"
    ? formatDeadline(current.firstTeeTime)
    : null;

  return (
    <MobileShell>
      <main className="flex flex-col flex-1 px-5 py-8 gap-6">
        {/* Wordmark */}
        <div className="pt-6">
          <h1 className="font-display font-bold text-5xl leading-[0.95] text-ink">
            The<br />Chipping<br />Forecast
          </h1>
          <p className="font-sans text-sm text-ink-2 mt-3">
            Pick 4 golfers. Lowest combined finish wins.
          </p>
        </div>

        {/* Tournament cards — always show current + past */}
        <div className="flex flex-col gap-3">
          {/* Current: live or upcoming */}
          {current && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
                  {tournamentTimingLabel(current.startDate)}
                </span>
              </div>
              {current.status === "in" ? (
                <Link href="/leaderboard" className="block">
                  <div className="border border-ink/10 bg-paper rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-display font-bold text-xl text-ink leading-tight">
                        {current.name}
                      </p>
                      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 bg-red-600 text-white border-red-600">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                        </span>
                        Live
                      </span>
                    </div>
                    {current.venue && (
                      <p className="font-sans text-xs text-ink-2">{current.venue}</p>
                    )}
                    <p className="font-sans text-xs text-ink underline mt-2 text-right">
                      View Live Leaderboard
                    </p>
                  </div>
                </Link>
              ) : (
                <div className={[
                  "border rounded-xl p-4",
                  current.fieldReady ? "border-accent bg-accent-soft" : "border-ink/10 bg-paper",
                ].join(" ")}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-display font-bold text-xl text-ink leading-tight">
                      {current.name}
                    </p>
                    <span className={[
                      "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0",
                      current.fieldReady
                        ? "bg-ink text-paper border-ink"
                        : "bg-paper text-ink-2 border-ink/20",
                    ].join(" ")}>
                      {current.fieldReady ? "Open for picks" : "Scheduled"}
                    </span>
                  </div>
                  {current.venue && (
                    <p className="font-sans text-xs text-ink-2">{current.venue}</p>
                  )}
                  {deadlineDisplay && (
                    <p className="font-sans text-xs text-ink-2 mt-1">
                      Pick deadline:{" "}
                      <span className="text-ink font-medium">{deadlineDisplay}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Past: most recently finished tournament */}
          {past && past.id !== current?.id && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
                  Past Tournaments
                </span>
              </div>
              <Link href="/leaderboard" className="block">
                <div className="border border-ink/10 bg-paper rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-display font-bold text-xl text-ink leading-tight">
                      {past.name}
                    </p>
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 bg-paper text-ink-2 border-ink/20">
                      Finished
                    </span>
                  </div>
                  {past.venue && (
                    <p className="font-sans text-xs text-ink-2">{past.venue}</p>
                  )}
                  <p className="font-sans text-xs text-ink underline mt-2 text-right">
                    View Results
                  </p>
                </div>
              </Link>
            </div>
          )}
        </div>

        <Divider />

        {/* CTA buttons */}
        <div className="flex flex-col gap-3">
          <Link href="/create" className="block">
            <Button variant="primary" full size="lg">
              + Start a group
            </Button>
          </Link>
          <Link href="/join" className="block">
            <Button variant="secondary" full size="lg">
              Join with code
            </Button>
          </Link>
        </div>

        {/* Schedule link */}
        <div className="flex justify-center">
          <Link
            href="/schedule#next-event"
            className="font-mono text-xs text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
          >
            View full 2026 schedule →
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-auto text-xs text-ink-3 text-center font-sans pb-4">
          no accounts · no apps · just a link
        </p>
      </main>
    </MobileShell>
  );
}

function tournamentTimingLabel(startDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  // Monday of the current week (Mon = 0 offset)
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - dayOfWeek);
  thisMonday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const weekAfter = new Date(nextMonday);
  weekAfter.setDate(nextMonday.getDate() + 7);

  if (start >= thisMonday && start < nextMonday) return "This week";
  if (start >= nextMonday && start < weekAfter) return "Next week";
  return "Coming up";
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
