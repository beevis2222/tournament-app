"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    setBusy(true);
    setError("");
    const { error: rpcError } = await createBrowserSupabase().rpc("create_club", { name });
    if (rpcError) {
      setError(
        rpcError.message.includes("club_exists")
          ? "A club is already set up. Ask the pro to add your email on the Staff screen."
          : "Something went wrong setting up the club. Try again.",
      );
      setBusy(false);
      return;
    }
    router.push("/events");
    router.refresh();
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <main className="page">
      <h1>Set up your club</h1>
      <p className="muted">You are the first person here, so you will be the pro for this club.</p>
      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Club name</span>
          <input name="name" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>Create club</button>
      </form>
      <p><button className="btn-quiet" type="button" onClick={signOut}>Sign out</button></p>
    </main>
  );
}
