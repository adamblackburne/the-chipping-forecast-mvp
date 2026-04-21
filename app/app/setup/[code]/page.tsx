"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PersonalLinkCard } from "@/components/onboarding/PersonalLinkCard";
import { saveSession, buildPersonalUrl } from "@/lib/session";

interface Props {
  params: Promise<{ code: string }>;
}

type Step = "name" | "link";

export default function SetupPage({ params }: Props) {
  const { code } = use(params);
  const router = useRouter();
  const upperCode = code.toUpperCase();

  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [personalUrl, setPersonalUrl] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [awaitingTournament, setAwaitingTournament] = useState(false);

  // If there's a ?t= token in the URL, check if we already have a session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) {
      // Returning user — skip setup, go straight to competition
      router.replace(`/competition/${upperCode}?t=${t}`);
    }
  }, [router, upperCode]);

  const handleSubmitName = useCallback(async () => {
    const name = displayName.trim();
    if (!name) {
      setNameError("Please enter a name");
      return;
    }
    setSubmitting(true);
    setNameError(null);
    try {
      const res = await fetch("/api/competition/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: upperCode, displayName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      const token: string = data.sessionToken;
      const url = buildPersonalUrl(upperCode, token);
      setSessionToken(token);
      setPersonalUrl(url);
      saveSession({ sessionToken: token, displayName: name, competitionCode: upperCode });

      // Check whether picks are available (tournament linked + field published)
      const compRes = await fetch(`/api/competition/${upperCode}`);
      const compData = await compRes.json();
      const compStatus = compData.competition?.status;
      let picksUnavailable = compStatus === "awaiting_tournament";
      if (!picksUnavailable && compStatus === "open") {
        const playersRes = await fetch(`/api/players?code=${upperCode}`);
        const playersData = await playersRes.json();
        if (!(playersData.players?.length > 0)) picksUnavailable = true;
      }
      setAwaitingTournament(picksUnavailable);

      setStep("link");
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [displayName, upperCode]);

  function handleContinue() {
    router.push(
      awaitingTournament
        ? `/competition/${upperCode}`
        : `/competition/${upperCode}/picks`
    );
  }

  return (
    <MobileShell>
      <TopBar back={`/join/${upperCode}`} title="Your name" />

      <main className="flex flex-col flex-1 px-5 py-6 gap-5 overflow-y-auto">
        {step === "name" && (
          <>
            <div>
              <h2 className="font-display font-bold text-2xl text-ink leading-tight">
                What should we call you?
              </h2>
              <p className="font-sans text-sm text-ink-2 mt-1">
                No email. No password. Just a name on the board.
              </p>
            </div>

            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitName()}
              placeholder="Your name"
              error={nameError ?? undefined}
              autoFocus
            />

            <div className="mt-auto pt-4">
              <Button
                variant="accent"
                full
                size="lg"
                onClick={handleSubmitName}
                disabled={submitting || !displayName.trim()}
              >
                {submitting ? "Joining…" : "Continue →"}
              </Button>
            </div>
          </>
        )}

        {step === "link" && personalUrl && sessionToken && (
          <>
            <div>
              <h2 className="font-display font-bold text-2xl text-ink leading-tight">
                You&apos;re in, {displayName}!
              </h2>
              <p className="font-sans text-sm text-ink-2 mt-1">
                {awaitingTournament
                  ? "Save your personal link — picks aren't open yet. Check back closer to the tournament."
                  : "Save your personal link before making picks."}
              </p>
            </div>

            <PersonalLinkCard url={personalUrl} />

            <div className="mt-auto pt-4">
              <Button
                variant="accent"
                full
                size="lg"
                onClick={handleContinue}
              >
                {awaitingTournament ? "I saved it — go to group →" : "I saved it — make picks →"}
              </Button>
            </div>
          </>
        )}
      </main>
    </MobileShell>
  );
}
