"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseDetails, type DetailsValues } from "@/lib/detailsForm";
import { saveDetails } from "./actions";

type Errors = Record<string, string>;

function Field({ label, error, help, children }: { label: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <label className={`field${error ? " bad" : ""}`}>
      <span>{label}</span>
      {children}
      {help && !error && <p className="help">{help}</p>}
      {error && <p className="msg" role="alert">{error}</p>}
    </label>
  );
}

export default function DetailsForm({ eventId, initial }: { eventId: string; initial: DetailsValues }) {
  const router = useRouter();
  const [v, setV] = useState<DetailsValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) => {
    setV((old) => ({ ...old, [key]: value }));
    setMessage(null);
  };
  const text = (key: Exclude<keyof DetailsValues, "flightNames" | "prizes">) => ({
    value: v[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = parseDetails(v);
    if (!check.ok) {
      setErrors(check.errors);
      setMessage({ kind: "error", text: "Fix the highlighted fields, then save again." });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveDetails(eventId, v);
      if (result.ok) {
        setMessage({ kind: "ok", text: "Saved." });
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        setMessage({ kind: "error", text: result.error ?? "Fix the highlighted fields, then save again." });
      }
    });
  }

  const flights = Math.max(1, Math.min(6, Number(v.flights) || 1));

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset className="group">
        <legend>The event</legend>
        <div className="form-grid">
          <Field label="Event name" error={errors.name}>
            <input type="text" {...text("name")} />
          </Field>
          <Field label="Date" error={errors.date}>
            <input type="date" {...text("date")} />
          </Field>
          <Field label="Rounds" error={errors.rounds} help="1 to 4 rounds.">
            <input type="number" min={1} max={4} {...text("rounds")} />
          </Field>
          <Field label="Holes each round" error={errors.holes}>
            <select {...text("holes")}>
              <option value="18">All 18</option>
              <option value="front">Front 9</option>
              <option value="back">Back 9</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Teams</legend>
        <div className="form-grid">
          <Field label="Players per team" error={errors.teamSize}>
            <select {...text("teamSize")}>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </Field>
          <Field label="How teams are made" error={errors.teamMode}>
            <select {...text("teamMode")}>
              <option value="balanced">Balanced teams (drawn by handicap)</option>
              <option value="listed">I will list the teams</option>
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Handicaps</legend>
        <div className="form-grid">
          <Field label="Team handicap method" error={errors.teamHandicap}>
            <select {...text("hcMethod")}>
              <option value="usga">USGA scramble percentages</option>
              <option value="custom">My own percentages</option>
              <option value="combined">Percent of combined handicaps</option>
              <option value="none">None (gross only)</option>
            </select>
          </Field>
          {v.hcMethod === "combined" && (
            <Field label="Percent of combined handicaps" error={errors.teamHandicap}>
              <input type="number" step="any" {...text("combinedPercent")} />
            </Field>
          )}
          {v.hcMethod !== "none" && (
            <Field label="Maximum team handicap" error={errors.maxTeamHandicap} help="Leave blank for no maximum.">
              <input type="number" min={0} step={1} {...text("maxTeamHandicap")} />
            </Field>
          )}
        </div>
        {v.hcMethod === "custom" && (
          <>
            <p className="muted">
              One percent per player, lowest handicap first, like 25, 20, 15, 10. Leave a row blank to use the USGA percentages for
              that team size.
            </p>
            <div className="form-grid">
              <Field label="4-man team" error={errors.pct4}>
                <input type="text" placeholder="25, 20, 15, 10" {...text("pct4")} />
              </Field>
              <Field label="3-man team" error={errors.pct3}>
                <input type="text" placeholder="30, 20, 10" {...text("pct3")} />
              </Field>
              <Field label="2-man team" error={errors.pct2}>
                <input type="text" placeholder="35, 15" {...text("pct2")} />
              </Field>
            </div>
          </>
        )}
        {v.hcMethod !== "none" && (
          <>
            <h3>Handicap limits</h3>
            <div className="form-grid">
              <Field label="Highest index allowed" error={errors.cap} help="Players above this play off it. Leave blank for no limit.">
                <input type="number" step="0.1" {...text("cap")} />
              </Field>
              <Field label="Biggest gap between partners" error={errors.gap} help="Leave blank for no limit.">
                <input type="number" step="0.1" {...text("gap")} />
              </Field>
              {v.gap.trim() !== "" && (
                <Field label="When the gap is too big" error={errors.gapMode}>
                  <select {...text("gapMode")}>
                    <option value="flag">Warn me</option>
                    <option value="reduce">Lower the higher index</option>
                  </select>
                </Field>
              )}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="group">
        <legend>Flights</legend>
        <div className="form-grid">
          <Field label="Number of flights" error={errors.flights} help="1 to 6.">
            <input type="number" min={1} max={6} {...text("flights")} />
          </Field>
        </div>
        {flights > 1 && (
          <div className="form-grid">
            {Array.from({ length: flights }, (_, i) => (
              <Field key={i} label={`Flight ${i + 1} name`}>
                <input
                  type="text"
                  placeholder={`Flight ${i + 1}`}
                  value={v.flightNames[i] ?? ""}
                  onChange={(e) => set("flightNames", v.flightNames.map((n, j) => (j === i ? e.target.value : n)))}
                />
              </Field>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="group">
        <legend>Start</legend>
        <div className="form-grid">
          <Field label="Start type" error={errors.start}>
            <select {...text("start")}>
              <option value="shotgun">Shotgun</option>
              <option value="teetimes">Tee times</option>
            </select>
          </Field>
          <Field label={v.start === "shotgun" ? "Shotgun time" : "First tee time"} error={errors.startTime}>
            <input type="time" {...text("startTime")} />
          </Field>
          {v.start === "teetimes" && (
            <Field label="Minutes between tee times" error={errors.interval} help="5 to 20.">
              <input type="number" min={5} max={20} {...text("interval")} />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>Gift card for each place</legend>
        {v.prizes.map((p, i) => (
          <div className="row row-gap" key={i}>
            <Field label={`Place ${i + 1} ($)`} error={errors[`prizes.${i}`]}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={p}
                onChange={(e) => set("prizes", v.prizes.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </Field>
          </div>
        ))}
        <div className="row row-gap">
          <button type="button" className="btn-quiet" onClick={() => set("prizes", [...v.prizes, "0"])}>
            Add place
          </button>
          {v.prizes.length > 0 && (
            <button type="button" className="btn-quiet" onClick={() => set("prizes", v.prizes.slice(0, -1))}>
              Remove last place
            </button>
          )}
        </div>
      </fieldset>

      {message && (
        <p className={message.kind === "ok" ? "ok" : "error"} role={message.kind === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
    </form>
  );
}
