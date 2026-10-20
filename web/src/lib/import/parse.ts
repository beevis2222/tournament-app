// Spreadsheet import parser. Pure port of the prototype's import functions.

export type ColumnRole = "ignore" | "name" | "first" | "last" | "index" | "tee" | "group" | "ghin";

export interface ImportedPlayer {
  name: string;
  index: number;
  nh: boolean;
  teeName: string | null;
  teeUnknown: boolean;
  ghin: string | null;
  group: string | null;
  row: number;
}

function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const d = lines.some((l) => l.includes("\t"))
    ? "\t"
    : lines.some((l) => l.includes(";")) && !lines.some((l) => l.includes(","))
      ? ";"
      : ",";
  return lines.map((l) => splitLine(l, d));
}

export function parseIdx(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/[()]/g, "");
  if (!s) return null;
  const m = s.match(/^(\+)?(-)?(\d{1,2}(?:[.,]\d+)?)$/);
  if (!m) return null;
  let n = Number(m[3].replace(",", "."));
  if (n > 54.0) return null;
  n = Math.round(n * 10) / 10;
  return m[1] || m[2] ? -n : n;
}

const hasText = (v: unknown) => /[a-z]/i.test(String(v));

function teeMatch(v: unknown, teeNames: string[]): string | null {
  const x = String(v || "").trim().toLowerCase().replace(/\s*tees?$/, "");
  if (!x) return null;
  return teeNames.find((t) => t.toLowerCase() === x) ?? null;
}

const HOLE_RE = /^(?:hole\s*)?#?(\d{1,2})\s*([ab])?$/i;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i;

export function guessMap(rows: string[][], teeNames: string[]): { header: boolean; map: ColumnRole[] } {
  const width = Math.max(...rows.map((r) => r.length));
  const r0 = rows[0] || [];
  const header =
    r0.every((c) => parseIdx(c) == null) &&
    r0.some((c) => /name|player|member|golfer|first|last|index|hcp|handicap|tee|group|foursome|hole|team/i.test(c));
  const map: ColumnRole[] = Array(width).fill("ignore");
  if (header) {
    let idxCol = -1;
    let idxScore = 0;
    const multiName = r0.filter((c) => /(player|golfer|name)\s*#?\d/i.test(c)).length > 1;
    r0.forEach((c, i) => {
      const k = String(c).toLowerCase();
      if (/ghin/.test(k) && !map.includes("ghin")) { map[i] = "ghin"; return; }
      if (multiName && /(player|golfer|name)\s*#?\d/.test(k) && !/hcp|handicap|index/.test(k)) map[i] = "name";
      else if (multiName && /hcp|handicap|index|^hi\b/.test(k)) map[i] = "index";
      else if (/tee ?time|start|group|foursome|pairing|hole|cart/.test(k) && !map.includes("group")) map[i] = "group";
      else if (/tee/.test(k) && !map.includes("tee")) map[i] = "tee";
      else if (/first/.test(k)) map[i] = "first";
      else if (/last|surname/.test(k)) map[i] = "last";
      else if (/index|hcp|handicap|^hi$|h\.i/.test(k)) {
        const sc = /index|^hi$|h\.i/.test(k) ? 3 : /course|playing/.test(k) ? 1 : 2;
        if (sc > idxScore) { idxScore = sc; idxCol = i; }
      } else if (/^team|company|sponsor/.test(k) && !map.includes("group")) map[i] = "group";
      else if (/name|player|member|golfer/.test(k) && !/#|number|\bno\b|\bid\b|ghin/.test(k) && !map.includes("name")) map[i] = "name";
    });
    if (idxCol >= 0 && !multiName) map[idxCol] = "index";
  }
  const data = header ? rows.slice(1) : rows;
  const colVals = (i: number) => data.map((r) => r[i]).filter((v) => String(v ?? "").trim());
  if (!map.includes("group")) { // repeated hole numbers or tee times
    for (let i = 0; i < width; i++) {
      if (map[i] !== "ignore") continue;
      const v = colVals(i);
      if (v.length < 4) continue;
      const likeStart = v.filter((x) => TIME_RE.test(x) || HOLE_RE.test(x)).length / v.length;
      const distinct = new Set(v).size;
      if (likeStart > 0.9 && distinct <= v.length / 2 && v.some((x) => TIME_RE.test(x) || /[ab]$/i.test(x) || distinct <= v.length / 3)) {
        map[i] = "group";
        break;
      }
    }
  }
  if (!map.includes("index")) {
    let best = -1;
    let bestShare = 0.5;
    for (let i = 0; i < width; i++) {
      const vals = colVals(i);
      if (!vals.length || map[i] !== "ignore") continue;
      const share = vals.filter((v) => parseIdx(v) != null).length / vals.length;
      const dec = vals.some((v) => /[.,]\d/.test(v));
      if (share > bestShare || (share === bestShare && dec)) { best = i; bestShare = share; }
    }
    if (best >= 0) map[best] = "index";
  }
  if (!map.includes("tee")) {
    for (let i = 0; i < width; i++) {
      if (map[i] !== "ignore") continue;
      const vals = colVals(i);
      if (vals.length && vals.filter((v) => teeMatch(v, teeNames)).length / vals.length > 0.6) { map[i] = "tee"; break; }
    }
  }
  if (!map.some((m) => m === "name" || m === "first" || m === "last")) {
    const textCols: number[] = [];
    for (let i = 0; i < width; i++) {
      if (map[i] !== "ignore") continue;
      const vals = colVals(i);
      if (vals.length && vals.filter(hasText).length / vals.length > 0.8 && vals.filter((v) => parseIdx(v) != null).length === 0) textCols.push(i);
    }
    if (textCols.length === 1) map[textCols[0]] = "name";
    else if (textCols.length >= 2 && textCols[1] === textCols[0] + 1) { map[textCols[0]] = "first"; map[textCols[1]] = "last"; }
    else if (textCols.length) map[textCols[0]] = "name";
  }
  return { header, map };
}

export function fixName(n: string): string {
  return /^[^,]+,\s*[^,]+$/.test(n) ? n.replace(/^([^,]+),\s*(.+)$/, "$2 $1") : n;
}

function makePlayer(name: string, idxRaw: unknown, teeRaw: string, teeNames: string[]) {
  const index = parseIdx(idxRaw);
  const tee = teeMatch(teeRaw, teeNames);
  return { name, index: index ?? 0, nh: index == null, teeName: tee, teeUnknown: !!teeRaw && !tee };
}

export function parseImport(
  rows: string[][],
  header: boolean,
  map: ColumnRole[],
  teeNames: string[],
): { players: ImportedPlayer[]; skipped: { row: number; reason: string }[]; multi: boolean } {
  const data = header ? rows.slice(1) : rows;
  const col = (role: ColumnRole) => map.indexOf(role);
  const cols = (role: ColumnRole) => map.map((m, i) => (m === role ? i : -1)).filter((i) => i >= 0);
  const nameCols = cols("name");
  const idxCols = cols("index");
  const gi = col("group");
  const ti = col("tee");
  const multi = nameCols.length > 1;
  const players: ImportedPlayer[] = [];
  const skipped: { row: number; reason: string }[] = [];
  data.forEach((r, ri) => {
    const g = gi >= 0 ? String(r[gi] ?? "").trim() : "";
    if (multi) {
      let any = false;
      nameCols.forEach((ci, k) => {
        const nm = fixName(String(r[ci] ?? "").trim());
        if (!nm) return;
        any = true;
        const p = makePlayer(nm, idxCols[k] != null ? r[idxCols[k]] : "", ti >= 0 ? String(r[ti] ?? "").trim() : "", teeNames);
        players.push({ ...p, ghin: null, group: g || "Row " + (ri + 1), row: ri });
      });
      if (!any) skipped.push({ row: ri, reason: "no names in row" });
    } else {
      const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
      const nm = nameCols.length
        ? fixName(get(nameCols[0]))
        : [get(col("first")), get(col("last"))].filter(Boolean).join(" ");
      if (!nm) { skipped.push({ row: ri, reason: "no name" }); return; }
      const p = makePlayer(nm, idxCols.length ? get(idxCols[0]) : "", get(ti), teeNames);
      players.push({ ...p, ghin: get(col("ghin")).replace(/\D/g, "") || null, group: g || null, row: ri });
    }
  });
  return { players, skipped, multi };
}

export function sheetGroups(players: ImportedPlayer[]): { label: string; players: ImportedPlayer[] }[] {
  const order: string[] = [];
  const by: Record<string, ImportedPlayer[]> = {};
  players.forEach((p) => {
    if (!p.group) return;
    if (!by[p.group]) { by[p.group] = []; order.push(p.group); }
    by[p.group].push(p);
  });
  return order.map((k) => ({ label: k, players: by[k] }));
}
