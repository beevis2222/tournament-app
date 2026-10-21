"use client";

import { useState, useTransition } from "react";
import { renameClub } from "./actions";

export default function ClubNameForm({ name }: { name: string }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("name"));
    startTransition(async () => {
      const result = await renameClub(value);
      setError(result.error ?? "");
      setSaved(!result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <label className="field">
        <span>Club name</span>
        <input name="name" defaultValue={name} maxLength={120} required onChange={() => setSaved(false)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>Save</button>
      {saved && <span className="muted" role="status"> Saved.</span>}
    </form>
  );
}
