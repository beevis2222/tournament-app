"use client";

import { useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { addStaffEmail, setStaffRemoved } from "./actions";

export type StaffRow = { id: string; email: string; role: string; signedUp: boolean; isMe: boolean };

export default function StaffManager({ rows }: { rows: StaffRow[] }) {
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const [undo, setUndo] = useState<{ id: string; email: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email"));
    startTransition(async () => {
      const result = await addStaffEmail(email);
      setError(result.error ?? "");
      setAdded(result.error ? "" : email.trim().toLowerCase());
      if (!result.error) form.reset();
    });
  }

  function remove(row: StaffRow) {
    startTransition(async () => {
      const result = await setStaffRemoved(row.id, true);
      setError(result.error ?? "");
      if (!result.error) setUndo({ id: row.id, email: row.email });
    });
  }

  function undoRemove() {
    if (!undo) return;
    const id = undo.id;
    setUndo(null);
    startTransition(async () => {
      const result = await setStaffRemoved(id, false);
      setError(result.error ?? "");
    });
  }

  return (
    <>
      <table className="list">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Signed up</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.email}</td>
              <td>{r.role}</td>
              <td>{r.signedUp ? "Yes" : "No"}</td>
              <td>
                {!r.isMe && (
                  <button className="btn-quiet" type="button" disabled={pending} onClick={() => remove(r)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add staff email</h2>
      <form className="card" onSubmit={onAdd}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          Add staff email
        </button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {added && (
        <p className="note">
          Added {added}. Tell them to go to {origin}/sign-up and create a password with this email.
        </p>
      )}
      {undo && <Toast message={`Removed ${undo.email}.`} onUndo={undoRemove} onDone={() => setUndo(null)} />}
    </>
  );
}
