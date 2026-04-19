import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { fetchTournamentPair } from "@/lib/espn";

export const revalidate = 600;

export default async function LandingPage() {
  const { inPlay, next } = await fetchTournamentPair().catch(() => ({ inPlay: null, next: null }));

  const nextDeadlineDisplay = next?.firstTeeTime && next.status === "pre"
    ? formatDeadline(next.firstTeeTime)
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

        {/* Tournament info */}
        {(inPlay || next) && (
          <div className="flex flex-col gap-3">
            {/* In-play tournament */}
            {inPlay && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
                    This week
                  </span>
                </div>
                <div className="border border-accent bg-accent-soft rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-display font-bold text-xl text-ink leading-tight">
                      {inPlay.name}
                    </p>
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 bg-ink text-paper border-ink">
                      Live
                    </span>
                  </div>
                  {inPlay.venue && (
                    <p className="font-sans text-xs text-ink-2">{inPlay.venue}</p>
                  )}
                </div>
              </div>
            )}

            {/* Next tournament — shown as "This week" when nothing is live, or "Open for picks" below the live one */}
            {next && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
                    {inPlay ? "Open for picks" : "This week"}
                  </span>
                </div>
                <div className="border border-accent bg-accent-soft rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-display font-bold text-xl text-ink leading-tight">
                      {next.name}
                    </p>
                    <span
                      className={[
                        "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0",
                        next.status === "in"
                          ? "bg-ink text-paper border-ink"
                          : "bg-paper text-ink-2 border-ink/20",
                      ].join(" ")}
                    >
                      {next.status === "in" ? "Live" : next.status === "pre" ? "Upcoming" : "Finished"}
                    </span>
                  </div>
                  {next.venue && (
                    <p className="font-sans text-xs text-ink-2">{next.venue}</p>
                  )}
                  {nextDeadlineDisplay && (
                    <p className="font-sans text-xs text-ink-2 mt-1">
                      Pick deadline:{" "}
                      <span className="text-ink font-medium">{nextDeadlineDisplay}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* Footer */}
        <p className="mt-auto text-xs text-ink-3 text-center font-sans pb-4">
          no accounts · no apps · just a link
        </p>
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
