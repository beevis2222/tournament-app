"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guessMap, parseDelimited, parseImport, sheetGroups, type ColumnRole, type ImportedPlayer } from "@/lib/import/parse";
import { makeTeams } from "../teams/actions";
import { importPlayers } from "./actions";
import type { OfferUndo } from "./FieldView";

const ROLES: { value: ColumnRole; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "name", label: "Name" },
  { value: "first", label: "First name" },
  { value: "last", label: "Last name" },
  { value: "index", label: "Handicap index" },
  { value: "tee", label: "Tee" },
  { value: "ghin", label: "GHIN number" },
  { value: "group", label: "Team / group" },
];

const EMPTY = "Nothing to import. That sheet looks empty.";

async function readFile(file: File): Promise<string[][]> {
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return [];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    return raw.map((r) => r.map((c) => String(c ?? "").trim()));
  }
  return parseDelimited(await file.text());
}

type Sheet = { rows: string[][]; header: boolean; map: ColumnRole[] };

export default function ImportPanel({
  eventId,
  teeNames,
  teamMode,
  teamCount,
  offerUndo,
}: {
  eventId: string;
  teeNames: string[];
  teamMode: "listed" | "balanced";
  teamCount: number;
  offerUndo: OfferUndo;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [sheetTeams, setSheetTeams] = useState<{ label: string; entryIds: string[] }[]>([]);
  const [pending, startTransition] = useTransition();

  function load(rows: string[][]) {
    setDone("");
    setSheetTeams([]);
    const kept = rows.filter((r) => r.some((c) => String(c ?? "").trim()));
    if (!kept.length) {
      setSheet(null);
      setError(EMPTY);
      return;
    }
    setError("");
    setSheet({ rows: kept, ...guessMap(kept, teeNames) });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      load(await readFile(file));
    } catch {
      setSheet(null);
      setError("Couldn't read that file. Try a CSV, or paste the list instead.");
    }
  }

  const parsed = sheet ? parseImport(sheet.rows, sheet.header, sheet.map, teeNames) : null;
  const hasName = sheet?.map.some((m) => m === "name" || m === "first" || m === "last") ?? false;
  const shownRow = (r: number) => r + 1 + (sheet?.header ? 1 : 0);
  const noIndex = parsed?.players.filter((p) => p.nh).length ?? 0;
  const badTee = parsed?.players.filter((p) => p.teeUnknown).length ?? 0;
  const groups = parsed ? sheetGroups(parsed.players) : [];

  function run(mode: "add" | "replace") {
    if (!parsed?.players.length) return;
    const players = parsed.players;
    setError("");
    startTransition(async () => {
      const result = await importPlayers(eventId, players, mode);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const noun = result.added === 1 ? "player" : "players";
      setDone(
        `${mode === "replace" ? "Field replaced with" : "Added"} ${result.added} ${noun}.` +
          (result.alreadyIn ? ` ${result.alreadyIn} already in the field.` : ""),
      );
      const byPlayer = new Map<ImportedPlayer, string>(players.map((p, i) => [p, result.entryIds[i]]));
      setSheetTeams(
        teamMode === "listed"
          ? sheetGroups(players).map((g) => ({ label: g.label, entryIds: g.players.map((p) => byPlayer.get(p)!).filter(Boolean) }))
          : [],
      );
      setSheet(null);
      setText("");
      offerUndo(`${mode === "replace" ? "Replaced the field" : `Added ${result.added} ${noun}`}.`, "field", result.undo);
      router.refresh();
    });
  }

  function useSheetTeams() {
    setError("");
    startTransition(async () => {
      const result = await makeTeams(eventId, "listed", sheetTeams);
      if (!result.ok) {
        setError(result.needsConfirm ? "Cards have been entered for the current teams. Make new teams on the Teams screen, where you can confirm." : result.error);
        return;
      }
      setSheetTeams([]);
      setDone(`Made ${result.teams} ${result.teams === 1 ? "team" : "teams"} from the spreadsheet.`);
      offerUndo("Teams made from the spreadsheet.", "teams", result.undo);
      router.refresh();
    });
  }

  return (
    <section className="card row-gap">
      <h2 style={{ marginTop: 0 }}>Import players</h2>
      <p className="muted">Paste a list from a spreadsheet, or upload a CSV or Excel file.</p>
      <label className="field">
        <span>Paste here</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Name\tIndex\nSmith, Joe\t8.4"} />
      </label>
      <div className="row">
        <button className="btn-quiet" type="button" disabled={!text.trim()} onClick={() => load(parseDelimited(text))}>
          Read the pasted list
        </button>
        <label className="btn-quiet">
          Upload a file
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.tsv,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="ok" role="status">{done}</p>}
      {sheetTeams.length > 0 && (
        <p className="note">
          The spreadsheet had teams.{" "}
          <button className="btn-quiet" type="button" disabled={pending} onClick={useSheetTeams}>
            Use the spreadsheet&apos;s teams ({sheetTeams.length})
          </button>
        </p>
      )}

      {sheet && parsed && (
        <>
          <h3>Check the columns</h3>
          <p className="muted">
            {sheet.header ? "The first row looks like headings." : "No heading row found."} Change a column&apos;s meaning if the guess is wrong.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="list">
              <thead>
                <tr>
                  {sheet.map.map((role, i) => (
                    <th key={i}>
                      <select
                        aria-label={`Column ${i + 1} meaning`}
                        value={role}
                        onChange={(e) => {
                          const map = [...sheet.map];
                          map[i] = e.target.value as ColumnRole;
                          setSheet({ ...sheet, map });
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, sheet.header ? 6 : 5).map((r, ri) => (
                  <tr key={ri} className={sheet.header && ri === 0 ? "muted" : undefined}>
                    {sheet.map.map((_, ci) => (
                      <td key={ci}>{r[ci] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasName ? (
            <p className="error">Choose which column has the players&apos; names.</p>
          ) : (
            <>
              <h3>{parsed.players.length} {parsed.players.length === 1 ? "player" : "players"} ready</h3>
              {noIndex > 0 && <p className="note">{noIndex} {noIndex === 1 ? "player has" : "players have"} no handicap. They go in as no handicap.</p>}
              {badTee > 0 && (
                <p className="note">
                  {badTee} {badTee === 1 ? "tee" : "tees"} not recognized. Those players start on the course&apos;s first tee.
                </p>
              )}
              {parsed.skipped.length > 0 && (
                <p className="note">
                  Skipped: {parsed.skipped.map((s) => `row ${shownRow(s.row)} (${s.reason})`).join(", ")}.
                </p>
              )}
              {groups.length > 0 && teamMode === "balanced" && (
                <p className="muted">This sheet has a team column, but this event draws balanced teams, so it is ignored.</p>
              )}
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                <table className="list">
                  <thead>
                    <tr><th>Row</th><th>Name</th><th>Index</th><th>Tee</th></tr>
                  </thead>
                  <tbody>
                    {parsed.players.map((p, i) => (
                      <tr key={i}>
                        <td>{shownRow(p.row)}</td>
                        <td>{p.name}</td>
                        <td>{p.nh ? "NH" : p.index < 0 ? `+${Math.abs(p.index)}` : p.index}</td>
                        <td>{p.teeName ?? (p.teeUnknown ? "Not recognized" : "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn" type="button" disabled={pending || !parsed.players.length} onClick={() => run("add")}>
                  Add to field
                </button>
                <button
                  className="btn-quiet"
                  type="button"
                  disabled={pending || !parsed.players.length || teamCount > 0}
                  onClick={() => run("replace")}
                >
                  Replace field
                </button>
                {teamCount > 0 && <span className="muted">Clear the teams first to replace the field.</span>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
