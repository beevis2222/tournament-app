"use client";

type Props = {
  pars: string[];
  si: string[];
  onPars: (next: string[]) => void;
  onSi: (next: string[]) => void;
  parsError?: string;
  siError?: string;
  idPrefix: string;
};

/** 18 par boxes and 18 stroke-index boxes, front nine then back nine. */
export default function ParSiGrid({ pars, si, onPars, onSi, parsError, siError, idPrefix }: Props) {
  const change = (list: string[], at: number, value: string, apply: (n: string[]) => void) =>
    apply(list.map((x, i) => (i === at ? value : x)));
  const total = pars.reduce((sum, p) => sum + (Number(p) || 0), 0);

  return (
    <div>
      {[0, 9].map((start) => (
        <div key={start}>
          <p className="muted" style={{ margin: "8px 0 4px" }}>{start === 0 ? "Front nine" : "Back nine"}</p>
          <div className="holes" role="group" aria-label={`Par, holes ${start + 1} to ${start + 9}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i}>
                <label htmlFor={`${idPrefix}-par-${start + i}`}>Par {start + i + 1}</label>
                <input
                  id={`${idPrefix}-par-${start + i}`}
                  inputMode="numeric"
                  value={pars[start + i] ?? ""}
                  onChange={(e) => change(pars, start + i, e.target.value, onPars)}
                />
              </div>
            ))}
          </div>
          <div className="holes" role="group" aria-label={`Stroke index, holes ${start + 1} to ${start + 9}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i}>
                <label htmlFor={`${idPrefix}-si-${start + i}`}>SI {start + i + 1}</label>
                <input
                  id={`${idPrefix}-si-${start + i}`}
                  inputMode="numeric"
                  value={si[start + i] ?? ""}
                  onChange={(e) => change(si, start + i, e.target.value, onSi)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="muted">Total par {total || "-"}</p>
      {parsError && <p className="error" role="alert">{parsError}</p>}
      {siError && <p className="error" role="alert">{siError}</p>}
    </div>
  );
}
