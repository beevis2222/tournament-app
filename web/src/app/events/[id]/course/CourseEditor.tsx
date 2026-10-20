"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ParSiGrid from "@/components/ParSiGrid";
import { validateCourse, type Errors } from "@/lib/courseValidation";
import { chooseCourse, saveCourse } from "./actions";
import TeeEditor, { type TeeRow } from "./TeeEditor";

export type CourseRow = { id: string; name: string; pars: number[]; si: number[] };

const BLANK = Array<string>(18).fill("");

export default function CourseEditor({
  eventId,
  courses,
  current,
  tees,
}: {
  eventId: string;
  courses: { id: string; name: string }[];
  current: CourseRow | null;
  tees: TeeRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(current?.name ?? "");
  const [pars, setPars] = useState<string[]>(current ? current.pars.map(String) : BLANK);
  const [si, setSi] = useState<string[]>(current ? current.si.map(String) : BLANK);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const showForm = creating || current !== null;

  function pick(value: string) {
    setMessage(null);
    setErrors({});
    if (value === "new") {
      setCreating(true);
      setName("");
      setPars(BLANK);
      setSi(BLANK);
      return;
    }
    setCreating(false);
    startTransition(async () => {
      const result = await chooseCourse(eventId, value || null);
      if (!result.ok) setMessage({ kind: "error", text: result.error ?? "Couldn't change the course." });
      else if (result.notice) setMessage({ kind: "ok", text: result.notice });
      router.refresh();
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const toNum = (x: string) => (x.trim() === "" ? NaN : Number(x));
    const input = { name, pars: pars.map(toNum), si: si.map(toNum) };
    const problems = validateCourse(input);
    if (Object.keys(problems).length) {
      setErrors(problems);
      setMessage({ kind: "error", text: "Fix the highlighted fields, then save again." });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveCourse(eventId, creating ? null : (current?.id ?? null), input);
      if (result.ok) {
        setCreating(false);
        setMessage({ kind: "ok", text: "Course saved." });
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        setMessage({ kind: "error", text: result.error ?? "Fix the highlighted fields, then save again." });
      }
    });
  }

  return (
    <>
      <label className="field">
        <span>Course for this event</span>
        <select value={creating ? "new" : (current?.id ?? "")} onChange={(e) => pick(e.target.value)} disabled={pending}>
          <option value="">Choose a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="new">New course…</option>
        </select>
      </label>

      {message && (
        <p className={message.kind === "ok" ? "ok" : "error"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p>
      )}

      {showForm && (
        <form className="card" onSubmit={save} noValidate>
          <h2 style={{ marginTop: 0 }}>{creating ? "New course" : "Course pars and stroke index"}</h2>
          {!creating && <p className="muted">Saved courses are shared by the whole club. Changes here apply to every event that uses this course.</p>}
          <label className={`field${errors.name ? " bad" : ""}`}>
            <span>Course name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <p className="msg" role="alert">{errors.name}</p>}
          </label>
          <ParSiGrid idPrefix="course" pars={pars} si={si} onPars={setPars} onSi={setSi} parsError={errors.pars} siError={errors.si} />
          <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save course"}</button>
        </form>
      )}

      {current && !creating && (
        <>
          <h2>Tees</h2>
          {tees.map((t) => (
            <TeeEditor key={t.id} eventId={eventId} courseId={current.id} tee={t} coursePars={current.pars} courseSi={current.si} />
          ))}
          <TeeEditor key={`new-${tees.length}`} eventId={eventId} courseId={current.id} tee={null} coursePars={current.pars} courseSi={current.si} />
          <p className="muted">Tees can be changed but not removed.</p>
        </>
      )}
    </>
  );
}
