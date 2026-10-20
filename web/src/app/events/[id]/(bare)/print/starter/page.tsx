import PrintBar from "@/components/PrintBar";
import PrintHeader from "@/components/PrintHeader";
import { printGroups, starterSheet } from "@/lib/printData";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

export default async function StarterPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, round, roundLabel, back } = await loadForPrint(id, (await searchParams).round);
  const sheet = starterSheet(round ? printGroups(bundle, round.id) : []);
  const title = ["Starter's sheet", roundLabel].filter(Boolean).join(", ");
  const showHcp = sheet.groups.some((g) => g.rows.some((r) => r.hcp));
  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      <PrintHeader name={bundle.event.name} date={bundle.event.date} title={title} />
      {sheet.groups.length === 0 ? (
        <p>No groups yet. Make the pairings first.</p>
      ) : (
        <>
          <p className="pr-note">
            {sheet.players} players, {sheet.groups.length} groups, {sheet.carts} carts
          </p>
          <table className="pr-table">
            <thead>
              <tr>
                <th style={{ width: "0.9in" }}>Start</th>
                <th>Player</th>
                <th style={{ width: "0.8in" }}>Tee</th>
                {showHcp && (
                  <th className="r" style={{ width: "0.6in" }}>
                    Hcp
                  </th>
                )}
                <th className="r" style={{ width: "0.6in" }}>
                  Cart
                </th>
                <th style={{ width: "0.55in", textAlign: "center" }}>In</th>
              </tr>
            </thead>
            {sheet.groups.map((g, gi) => (
              <tbody key={gi} className="pr-keep">
                {g.rows.map((r, i) => (
                  <tr key={i} className={i === 0 ? "gstart" : ""}>
                    {i === 0 && (
                      <td rowSpan={g.rows.length} className="pr-st">
                        {g.start}
                        {g.label && <small>{g.label}</small>}
                      </td>
                    )}
                    <td>
                      {r.name} <small>{r.team}</small>
                    </td>
                    <td>{r.tee}</td>
                    {showHcp && <td className="r">{r.hcp}</td>}
                    <td className="r big">{r.cart}</td>
                    <td className="ck"></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </>
      )}
    </main>
  );
}
