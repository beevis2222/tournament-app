"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/Toast";
import { undoTeams, type TeamsUndo } from "../teams/actions";
import { undoFieldChange, type FieldUndo } from "./actions";
import FieldTable, { type FieldRow, type TeeOption } from "./FieldTable";
import ImportPanel from "./ImportPanel";
import RosterPicker, { type RosterRow } from "./RosterPicker";

/** Shows the 10-second Undo toast. `kind` says what the undo data is for. */
export type OfferUndo = {
  (message: string, kind: "field", undo: FieldUndo): void;
  (message: string, kind: "teams", undo: TeamsUndo): void;
  (message: string, kind: "custom", undo: () => Promise<{ ok: boolean; error?: string }>): void;
};

type Pending = { message: string; run: () => Promise<{ ok: boolean; error?: string }> };

export default function FieldView({
  eventId,
  teeNames,
  tees,
  teamMode,
  teamCount,
  entries,
  roster,
  hasCourse,
  warnings,
}: {
  eventId: string;
  teeNames: string[];
  tees: TeeOption[];
  teamMode: "listed" | "balanced";
  teamCount: number;
  entries: FieldRow[];
  roster: RosterRow[];
  hasCourse: boolean;
  warnings: Record<string, string[]>;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<Pending | null>(null);
  const [error, setError] = useState("");

  const offerUndo: OfferUndo = (message: string, kind: string, undo: unknown) => {
    const run =
      kind === "field"
        ? () => undoFieldChange(eventId, undo as FieldUndo)
        : kind === "teams"
          ? () => undoTeams(eventId, undo as TeamsUndo)
          : (undo as Pending["run"]);
    setToast({ message, run });
  };

  async function undo() {
    const t = toast;
    setToast(null);
    if (!t) return;
    const result = await t.run();
    setError(result.ok ? "" : (result.error ?? "Couldn't undo that."));
    router.refresh();
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <ImportPanel eventId={eventId} teeNames={teeNames} teamMode={teamMode} teamCount={teamCount} offerUndo={offerUndo} />
      <RosterPicker eventId={eventId} roster={roster} offerUndo={offerUndo} />
      {!hasCourse && (
        <p className="note">
          <Link href={`/events/${eventId}/course`}>Choose a course first</Link> to check handicap limits.
        </p>
      )}
      <FieldTable entries={entries} tees={tees} warnings={warnings} offerUndo={offerUndo} />
      {toast && <Toast message={toast.message} onUndo={undo} onDone={() => setToast(null)} />}
    </>
  );
}
