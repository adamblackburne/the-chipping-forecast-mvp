import { Chip } from "@/components/ui/Chip";

export interface ParticipantStatus {
  id: string;
  displayName: string;
  picksComplete: boolean;
  pickCount: number;
}

interface ParticipantListProps {
  participants: ParticipantStatus[];
  currentParticipantId?: string;
}

export function ParticipantList({ participants, currentParticipantId }: ParticipantListProps) {
  const inCount = participants.filter((p) => p.picksComplete).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-0.5 bg-ink inline-block" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
          Group ({inCount} / {participants.length} in)
        </span>
      </div>

      <div className="divide-y divide-line-soft">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-full border border-ink bg-paper-2 flex items-center justify-center text-xs font-sans font-semibold shrink-0"
                aria-hidden
              >
                {p.displayName[0]?.toUpperCase()}
              </span>
              <span className="font-sans text-sm text-ink">
                {p.displayName}
                {p.id === currentParticipantId && <span className="text-ink-3 ml-1 text-xs">(you)</span>}
              </span>
            </div>
            {p.picksComplete ? (
              <Chip variant="accent">in</Chip>
            ) : (
              <Chip variant="warn">
                {p.pickCount}/4 picked
              </Chip>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
