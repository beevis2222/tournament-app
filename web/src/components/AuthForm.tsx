"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyAuthError, signUpOutcome } from "@/lib/authErrors";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const signingIn = mode === "sign-in";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const credentials = {
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    };
    setBusy(true);
    setError("");
    const auth = createBrowserSupabase().auth;
    setNotice("");
    const { data, error: authError } = signingIn
      ? await auth.signInWithPassword(credentials)
      : await auth.signUp(credentials);
    if (authError) {
      setError(friendlyAuthError(authError.message));
      setBusy(false);
      return;
    }
    if (!signingIn && signUpOutcome(data) === "check-email") {
      setNotice("Check your email for a link to finish signing up, then sign in.");
      setBusy(false);
      return;
    }
    router.push("/events");
    router.refresh();
  }

  return (
    <main className="page">
      <h1>{signingIn ? "Sign in" : "Create your password"}</h1>
      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span>Password{signingIn ? "" : " (at least 8 characters)"}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signingIn ? "current-password" : "new-password"}
          />
        </label>
        {notice && <p className="note" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {signingIn ? "Sign in" : "Create password"}
        </button>
      </form>
      <p className="muted">
        {signingIn ? "New to the club staff? " : "Already have a password? "}
        <Link href={signingIn ? "/sign-up" : "/sign-in"}>{signingIn ? "Create a password" : "Sign in"}</Link>
      </p>
    </main>
  );
}
