import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import NoStartNote from "@/components/NoStartNote";
import { pickRound } from "@/lib/printData";

const SHEETS = [
  { slug: "pairings", label: "Pairings", help: "Who plays with whom, and where they start.", rounds: true },
  { slug: "cards", label: "Scorecards", help: "One card per team, with handicap stroke dots.", rounds: true },
  { slug: "cart-signs", label: "Cart signs", help: "A sign for each cart, two per page.", rounds: true },
  { slug: "starter", label: "Starter's sheet", help: "Every player in start order, with carts and a check-in box.", rounds: true },
  { slug: "alpha", label: "Alpha list", help: "Players by last name, with their start.", rounds: true },
  { slug: "results", label: "Results", help: "Leaderboard and prizes for the whole event.", rounds: false },
];

export default async function PrintMenu({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  const { id } = await params;
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }
  const rounds = [...bundle.rounds].sort((a, b) => a.number - b.number);
  const current = pickRound(bundle, (await searchParams).round);
  const q = current && rounds.length > 1 ? `?round=${current.number}` : "";

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Print</h2>
      {rounds.length > 1 && (
        <p className="row-gap">
          Round:{" "}
          {rounds.map((r) => (
            <Link
              key={r.id}
              href={`/events/${id}/print?round=${r.number}`}
              style={{ marginRight: 12, fontWeight: r.id === current?.id ? 700 : 400 }}
              aria-current={r.id === current?.id ? "true" : undefined}
            >
              Round {r.number}
            </Link>
          ))}
        </p>
      )}
      {current && <NoStartNote bundle={bundle} roundId={current.id} />}
      <ul className="print-menu" style={{ listStyle: "none", padding: 0 }}>
        {SHEETS.map((s) => (
          <li key={s.slug} style={{ margin: "0 0 12px" }}>
            <Link href={`/events/${id}/print/${s.slug}${s.rounds ? q : ""}`} style={{ fontWeight: 600 }}>
              {s.label}
            </Link>
            <div className="muted">{s.help}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
