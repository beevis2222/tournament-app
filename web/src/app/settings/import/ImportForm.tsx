"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MAX_BACKUP_BYTES } from "@/lib/importPlan";
import { importBackup, type ImportResult } from "./actions";

export default function ImportForm() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setResult({ imported: [], skipped: [], failed: [], error: "That file is too big to be a backup (limit 5 MB)." });
      input.value = "";
      return;
    }
    const text = await file.text();
    input.value = "";
    startTransition(async () => {
      try {
        setResult(await importBackup(text));
      } catch {
        setResult({ imported: [], skipped: [], failed: [], error: "Couldn't import that file. Try again." });
      }
    });
  }

  return (
    <>
      <label className="field">
        <span>Backup file (.json)</span>
        <input type="file" accept=".json,application/json" onChange={onPick} disabled={pending} />
      </label>
      {pending && <p className="muted" role="status">Importing…</p>}
      {result?.error && <p className="error" role="alert">{result.error}</p>}
      {result && !result.error && (
        <div className="card" role="status">
          {result.imported.length > 0 && <p>Imported: {result.imported.join(", ")}</p>}
          {result.skipped.map((s) => (
            <p key={s.name + s.reason}>Not imported yet: {s.name} ({s.reason})</p>
          ))}
          {result.failed.map((n) => (
            <p key={n} className="error">Couldn&apos;t import {n}.</p>
          ))}
          {result.imported.length + result.skipped.length + result.failed.length === 0 && <p>Nothing to import.</p>}
          {result.imported.length > 0 && <p><Link href="/events">Go to Events</Link></p>}
        </div>
      )}
    </>
  );
}
