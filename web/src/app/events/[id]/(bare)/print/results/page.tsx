import Link from "next/link";
import PrintBar from "@/components/PrintBar";
import PrintHeader from "@/components/PrintHeader";
import { buildFlights } from "@/lib/boards";
import { formatMoney } from "@/lib/money";
import { hasCourse } from "@/lib/toEngine";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

export default async function ResultsPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, back } = await loadForPrint(id, (await searchParams).round);
  const final = bundle.event.status === "final";
  const title = final ? "Final results" : "Leaderboard, in progress";

  if (!hasCourse(bundle)) {
    return (
      <main className="pr-page">
        <PrintBar backHref={back} />
        <p>
          <Link href={`/events/${id}/course`}>Choose a course first</Link> so results can be worked out.
        </p>
      </main>
    );
  }

  const flights = buildFlights(bundle);
  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      <PrintHeader name={bundle.event.name} date={bundle.event.date} title={title} />
      {flights.map((f, fi) =>
        f.boards.map((b) => (
          <section key={`${fi}-${b.kind}`} className="pr-keep">
            <h2 className="pr-flight">{[f.name, b.kind === "net" ? "Net" : "Gross"].filter(Boolean).join(", ")}</h2>
            {b.rows.length === 0 ? (
              <p>No teams.</p>
            ) : (
              <table className="pr-table">
                <thead>
                  <tr>
                    <th style={{ width: "0.5in" }}>Pos</th>
                    <th>Team</th>
                    <th className="r">Thru</th>
                    <th className="r">Gross</th>
                    {b.kind === "net" && <th className="r">Net</th>}
                    <th className="r">To par</th>
                    <th className="r">Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r) => (
                    <tr key={r.teamId}>
                      <td>{r.pos}</td>
                      <td>
                        {r.team}
                        <br />
                        <small>{r.players.join(", ")}</small>
                      </td>
                      <td className="r">{r.thru}</td>
                      <td className="r">{r.gross ?? ""}</td>
                      {b.kind === "net" && <td className="r">{r.net ?? ""}</td>}
                      <td className="r big">{r.toPar}</td>
                      <td className="r">{r.prize !== null ? formatMoney(r.prize) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )),
      )}
      {!final && <p className="pr-note">Prizes are provisional until the event is final.</p>}
    </main>
  );
}
