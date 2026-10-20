"use client";

import { useRef } from "react";

export type HoleGridProps = {
  /** Holes in play, 0-based, in order (9 or 18). */
  holes: number[];
  pars: number[];
  /** Strokes received per hole (index 0-17); negative = strokes given back. */
  strokes: number[];
  texts: string[];
  /** Messages by hole index (bad number). */
  errors: Record<number, string>;
  /** Holes whose last save failed, with the reason. */
  failed: Record<number, string>;
  /** Display sums of the scores entered on holes 1-9 and 10-18. */
  out: number | null;
  inn: number | null;
  /** Round total from the engine. */
  total: number | null;
  onChange: (hole: number, text: string) => void;
  onBlur: (hole: number) => void;
  onRetry: (hole: number) => void;
};

const dots = (n: number) => (n > 0 ? "•".repeat(n) : n < 0 ? "+".repeat(-n) : "");
const show = (n: number | null) => (n === null ? "–" : n);

/** The scorecard grid: par, stroke dots and one score box per hole, with Out / In / Total. */
export default function HoleGrid(p: HoleGridProps) {
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  const front = p.holes.filter((h) => h < 9);
  const back = p.holes.filter((h) => h >= 9);
  const segs = [
    { holes: front, label: "Out", sum: p.out },
    { holes: back, label: "In", sum: p.inn },
  ].filter((s) => s.holes.length > 0);
  const parOf = (list: number[]) => list.reduce((a, h) => a + p.pars[h], 0);

  function move(from: number, by: number) {
    const to = p.holes[p.holes.indexOf(from) + by];
    if (to === undefined) {
      if (by > 0) refs.current[from]?.blur(); // last hole: leaving the box saves it
      return;
    }
    refs.current[to]?.focus();
  }

  function onKey(e: React.KeyboardEvent, h: number) {
    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      move(h, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(h, -1);
    }
  }

  // Messages only for holes on screen (a hole hidden by Front / Back 9 only has no box to point at).
  const visible = (h: number) => p.holes.includes(h);
  const failedHoles = Object.keys(p.failed).map(Number).filter(visible).sort((a, b) => a - b);

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table className="hole-grid">
          <thead>
            <tr>
              <th scope="row">Hole</th>
              {segs.flatMap((s) => [
                ...s.holes.map((h) => <th key={h} scope="col">{h + 1}</th>),
                <th key={s.label} scope="col">{s.label}</th>,
              ])}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Par</th>
              {segs.flatMap((s) => [
                ...s.holes.map((h) => <td key={h}>{p.pars[h]}</td>),
                <td key={s.label}>{parOf(s.holes)}</td>,
              ])}
              <td>{parOf(p.holes)}</td>
            </tr>
            <tr>
              <th scope="row">Strokes</th>
              {segs.flatMap((s) => [
                ...s.holes.map((h) => (
                  <td key={h} aria-label={`Hole ${h + 1} strokes ${p.strokes[h]}`}>{dots(p.strokes[h])}</td>
                )),
                <td key={s.label} />,
              ])}
              <td />
            </tr>
            <tr>
              <th scope="row">Score</th>
              {segs.flatMap((s) => [
                ...s.holes.map((h) => (
                  <td key={h}>
                    <input
                      ref={(el) => {
                        refs.current[h] = el;
                      }}
                      className={`hole-input${p.errors[h] || p.failed[h] ? " bad" : ""}`}
                      aria-label={`Hole ${h + 1} score`}
                      aria-invalid={Boolean(p.errors[h] || p.failed[h])}
                      inputMode="numeric"
                      autoComplete="off"
                      value={p.texts[h] ?? ""}
                      onChange={(e) => p.onChange(h, e.target.value)}
                      onBlur={() => p.onBlur(h)}
                      onKeyDown={(e) => onKey(e, h)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </td>
                )),
                <td key={s.label} className="grid-sum">{show(s.sum)}</td>,
              ])}
              <td className="grid-sum"><strong>{show(p.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      {Object.entries(p.errors).filter(([h]) => visible(Number(h))).map(([h, msg]) => (
        <p key={h} className="error" role="alert">Hole {Number(h) + 1}: {msg}</p>
      ))}
      {failedHoles.map((h) => (
        <div key={h} className="save-failed" role="alert">
          <span>Hole {h + 1}: {p.failed[h]}</span>{" "}
          <button type="button" className="btn-quiet" onClick={() => p.onRetry(h)}>Not saved — retry</button>
        </div>
      ))}
    </div>
  );
}
