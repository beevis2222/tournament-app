"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { undoCourse, type CourseUndo } from "./actions";
import CourseEditor, { type CourseRow } from "./CourseEditor";
import type { TeeRow } from "./TeeEditor";

/** The editor plus the Undo toast. The editor restarts when the course changes; this stays, so Undo survives that. */
export default function CourseScreen(props: {
  eventId: string;
  courses: { id: string; name: string }[];
  current: CourseRow | null;
  tees: TeeRow[];
  needsConfirm: boolean;
}) {
  const router = useRouter();
  const [undo, setUndo] = useState<CourseUndo | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function runUndo() {
    const u = undo;
    setUndo(null);
    if (!u) return;
    startTransition(async () => {
      const result = await undoCourse(props.eventId, u);
      setNote(result.ok ? { kind: "ok", text: "Course change undone." } : { kind: "error", text: result.error ?? "Couldn't undo." });
      router.refresh();
    });
  }

  return (
    <>
      {note && <p className={note.kind === "ok" ? "ok" : "error"} role={note.kind === "ok" ? "status" : "alert"}>{note.text}</p>}
      <CourseEditor
        key={props.current?.id || "none"}
        {...props}
        onUndoOffer={(data) => {
          setNote(null);
          setUndo(data);
        }}
      />
      {undo && !pending && <Toast message="Course changed." onUndo={runUndo} onDone={() => setUndo(null)} />}
    </>
  );
}
