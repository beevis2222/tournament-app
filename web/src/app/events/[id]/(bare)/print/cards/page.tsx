import Link from "next/link";
import { holesInPlay } from "@starter/scoring";
import PrintBar from "@/components/PrintBar";
import { printGroups, strokesForTeam } from "@/lib/printData";
import { hasCourse, toEngine } from "@/lib/toEngine";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

const dots = (n: number) => (n > 0 ? "•".repeat(Math.min(n, 3)) : n < 0 ? "+" : "");

export default async function CardsPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, round, roundLabel, back } = await loadForPrint(id, (await searchParams).round);

  if (!hasCourse(bundle)) {
    return (
      <main className="pr-page">
        <PrintBar backHref={back} />
        <p>
          <Link href={`/events/${id}/course`}>Choose a course first</Link> so the scorecards have pars and handicaps.
        </p>
      </main>
    );
  }

  const ev = toEngine(bundle);
  const roundIdx = round ? [...bundle.rounds].sort((a, c) => a.number - c.number).findIndex((r) => r.id === round.id) : -1;
  const groups = round ? printGroups(bundle, round.id) : [];
  const holes = roundIdx >= 0 ? holesInPlay(ev.holes, ev.rounds[roundIdx]) : [];
  const net = groups.some((g) => g.teams.some((t) => t.hcp !== null));
  const cards = groups.flatMap((g) => g.teams.map((t) => ({ start: g.start, team: t, calc: strokesForTeam(ev, t.id, roundIdx) })));

  if (cards.length === 0 || holes.length === 0) {
    return (
      <main className="pr-page">
        <PrintBar backHref={back} />
        <p>{cards.length === 0 ? "No groups yet. Make the pairings first." : "This round is called off, so there are no holes to score."}</p>
      </main>
    );
  }

  const segs = [
    { label: "Out", list: holes.filter((h) => h < 9) },
    { label: "In", list: holes.filter((h) => h >= 9) },
  ].filter((s) => s.list.length > 0);
  const parSum = (list: number[]) => list.reduce((a, h) => a + ev.course.pars[h], 0);

  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      <div className="pr-cards">
        {cards.map((c) => (
          <div key={`${c.start}-${c.team.id}`} className="pr-card">
            <div className="pr-card-top">
              <b>{c.start}</b>
              <span>{[bundle.event.name, roundLabel].filter(Boolean).join(", ")}</span>
              <span>{bundle.event.date}</span>
            </div>
            <table className="pr-sct">
              <tbody>
                <tr>
                  <th className="nm">Hole</th>
                  {segs.flatMap((s) => [
                    ...s.list.map((h) => <th key={h}>{h + 1}</th>),
                    <th key={s.label} className="sub">
                      {s.label}
                    </th>,
                  ])}
                  <th className="sub">Tot</th>
                </tr>
                <tr className="mini">
                  <td className="nm">Par</td>
                  {segs.flatMap((s) => [
                    ...s.list.map((h) => <td key={h}>{ev.course.pars[h]}</td>),
                    <td key={s.label}>{parSum(s.list)}</td>,
                  ])}
                  <td>{parSum(holes)}</td>
                </tr>
                <tr className="mini">
                  <td className="nm">Handicap</td>
                  {segs.flatMap((s) => [...s.list.map((h) => <td key={h}>{ev.course.si[h]}</td>), <td key={s.label} />])}
                  <td />
                </tr>
                <tr>
                  <td className="nm">
                    {c.team.label}
                    {c.team.hcp !== null ? ` (${c.team.hcp})` : ""}
                  </td>
                  {segs.flatMap((s) => [
                    ...s.list.map((h) => (
                      <td key={h} className="dotcell">
                        {c.calc ? dots(c.calc.strokes[h]) : ""}
                      </td>
                    )),
                    <td key={s.label} className="sub" />,
                  ])}
                  <td className="sub" />
                </tr>
              </tbody>
            </table>
            <div className="pr-players">{c.team.players.map((p) => p.name).join(", ")}</div>
            <div className="pr-sig">
              <span>Scorer</span>
              <span>Attest</span>
            </div>
            {net && <div className="pr-note">Dots mark handicap strokes.</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
