"use client";

import { useState, useEffect } from "react";
import { getSession } from "@/lib/session";

interface Props {
  code: string;
}

export function PersonalLinkSection({ code }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session?.sessionToken) {
      const base = window.location.origin;
      setUrl(`${base}/competition/${code}?t=${session.sessionToken}`);
    }
  }, [code]);

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!url) return;
    if (navigator.share) {
      await navigator.share({
        title: "The Chipping Forecast — your personal link",
        text: "This link logs you back in. Save it!",
        url,
      });
    } else {
      await handleCopy();
    }
  }

  if (!url) return null;

  return (
    <div className="mt-auto pt-4 border-t border-line-soft space-y-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-2 mb-0.5">
          Your personal link
        </p>
        <p className="font-sans text-xs text-ink-3">
          This link logs you back in — save it somewhere safe.
        </p>
      </div>

      <div className="bg-paper-2 rounded-lg px-3 py-2 border border-line-soft overflow-hidden">
        <p className="font-mono text-[11px] text-ink-2 break-all leading-relaxed">{url}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 py-2 rounded-lg border border-line-soft bg-paper font-sans text-sm text-ink text-center active:bg-paper-2 transition-colors"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-2 rounded-lg border border-line-soft bg-paper font-sans text-sm text-ink text-center active:bg-paper-2 transition-colors"
        >
          Share
        </button>
      </div>
    </div>
  );
}
