import { noStartText, teamsWithoutStart } from "@/lib/printData";
import type { EventBundle } from "@/lib/types";

/** Says how many playing teams are in none of the round's groups (they are left off the sheets). Nothing when all are placed. */
export default function NoStartNote({ bundle, roundId, className }: { bundle: EventBundle; roundId: string; className?: string }) {
  const n = teamsWithoutStart(bundle, roundId);
  if (n === 0) return null;
  return (
    <p className={className ?? "note"} role="note">
      {noStartText(n)}
    </p>
  );
}
