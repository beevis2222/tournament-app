"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ParSiGrid from "@/components/ParSiGrid";
import { validateTee, type Errors } from "@/lib/courseValidation";
import { saveTee } from "./actions";

export type TeeRow = { id: string; name: string; rating: number; slope: number; pars: number[] | null; si: number[] | null };

const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** One tee: a saved one to change, or (tee = null) the form to add a new one. */
export default function TeeEditor({
  eventId,
  courseId,
  tee,
  coursePars,
  courseSi,
}: {
  eventId: string;
  courseId: string;
  tee: TeeRow | null;
  coursePars: number[];
  courseSi: number[];
}) {
  const router = useRouter();
  const [name, setName] = useState(tee?.name ?? "");
  const [rating, setRating] = useState(tee ? String(tee.rating) : "");
  const [slope, setSlope] = useState(tee ? String(tee.slope) : "");
  const [own, setOwn] = useState(Boolean(tee?.pars || tee?.si));
  const [pars, setPars] = useState<string[]>((tee?.pars ?? coursePars).map(String));
  const [si, setSi] = useState<string[]>((tee?.si ?? courseSi).map(String));
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const id = tee?.id ?? "new";

  function save(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      name,
      rating: toNum(rating),
      slope: toNum(slope),
      pars: own ? pars.map(toNum) : null,
      si: own ? si.map(toNum) : null,
    };
    const problems = validateTee(input);
    if (Object.keys(problems).length) {
      setErrors(problems);
      setMessage({ kind: "error", text: "Fix the highlighted fields, then save again." });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveTee(eventId, courseId, tee?.id ?? null, input);
      if (result.ok) {
        setMessage({ kind: "ok", text: tee ? "Tee saved." : "Tee added." });
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        setMessage({ kind: "error", text: result.error ?? "Fix the highlighted fields, then save again." });
      }
    });
  }

  return (
    <form className="tee-card" onSubmit={save} noValidate aria-label={tee ? `Tee ${tee.name}` : "Add a tee"}>
      <h3 style={{ marginTop: 0 }}>{tee ? tee.name : "Add a tee"}</h3>
      <div className="form-grid">
        <label className={`field${errors.name ? " bad" : ""}`}>
          <span>Tee name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="White" />
          {errors.name && <p className="msg" role="alert">{errors.name}</p>}
        </label>
        <label className={`field${errors.rating ? " bad" : ""}`}>
          <span>Course rating</span>
          <input type="number" step="0.1" value={rating} onChange={(e) => setRating(e.target.value)} />
          {errors.rating && <p className="msg" role="alert">{errors.rating}</p>}
        </label>
        <label className={`field${errors.slope ? " bad" : ""}`}>
          <span>Slope</span>
          <input type="number" step="1" value={slope} onChange={(e) => setSlope(e.target.value)} />
          {errors.slope && <p className="msg" role="alert">{errors.slope}</p>}
        </label>
      </div>
      <label className="row row-gap">
        <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
        This tee has different pars or stroke index
      </label>
      {own && <ParSiGrid idPrefix={`tee-${id}`} pars={pars} si={si} onPars={setPars} onSi={setSi} parsError={errors.pars} siError={errors.si} />}
      {message && (
        <p className={message.kind === "ok" ? "ok" : "error"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p>
      )}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : tee ? "Save tee" : "Add tee"}</button>
    </form>
  );
}
