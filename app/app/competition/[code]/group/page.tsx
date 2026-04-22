import { MobileShell } from "@/components/layout/MobileShell";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { supabase } from "@/lib/supabase";
import type { Competition, Participant } from "@/lib/supabase";
import { PersonalLinkSection } from "@/components/competition/PersonalLinkSection";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function GroupPage({ params }: Props) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const { data: comp } = await supabase
    .from("competitions")
    .select("*")
    .eq("join_code", upperCode)
    .single<Competition>();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, display_name, created_at")
    .eq("competition_id", comp?.id ?? "")
    .order("created_at", { ascending: true })
    .returns<Pick<Participant, "id" | "display_name" | "created_at">[]>();

  return (
    <MobileShell>
      <TopBar title="Group" />
      <main className="flex flex-col flex-1 px-5 py-5 gap-4 overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
            Members ({participants?.length ?? 0})
          </span>
        </div>

        <div className="divide-y divide-line-soft">
          {(participants ?? []).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 py-3">
              <span
                className="w-8 h-8 rounded-full border border-ink bg-paper-2 flex items-center justify-center text-sm font-sans font-semibold shrink-0"
                aria-hidden
              >
                {p.display_name[0]?.toUpperCase()}
              </span>
              <span className="font-sans text-sm text-ink">{p.display_name}</span>
              {i === 0 && (
                <span className="ml-auto font-sans text-xs text-ink-3">host</span>
              )}
            </div>
          ))}
        </div>

        {comp && (
          <div className="pt-4 border-t border-line-soft">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-2 mb-1">
              Join code
            </p>
            <p className="font-mono text-2xl tracking-widest text-ink">
              {upperCode.slice(0, 3)}-{upperCode.slice(3)}
            </p>
          </div>
        )}

        <PersonalLinkSection code={upperCode} />
      </main>
      <TabBar competitionCode={upperCode} />
    </MobileShell>
  );
}
