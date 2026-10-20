import Link from "next/link";
import ImportForm from "./ImportForm";

export default function ImportPage() {
  return (
    <main className="page">
      <p><Link href="/settings">&larr; Settings</Link></p>
      <h1>Import prototype backup</h1>
      <p className="muted">
        Choose the backup file you saved from the prototype. Each scramble is added as a new event.
        Your existing events are never changed.
      </p>
      <ImportForm />
    </main>
  );
}
