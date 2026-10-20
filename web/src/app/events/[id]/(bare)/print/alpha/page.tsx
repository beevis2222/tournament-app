import PrintBar from "@/components/PrintBar";
import PrintHeader from "@/components/PrintHeader";
import { alphaRows, printGroups } from "@/lib/printData";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

export default async function AlphaPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, round, roundLabel, back } = await loadForPrint(id, (await searchParams).round);
  const rows = round ? alphaRows(printGroups(bundle, round.id)) : [];
  const title = ["Alpha list", roundLabel].filter(Boolean).join(", ");
  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      <PrintHeader name={bundle.event.name} date={bundle.event.date} title={title} />
      {rows.length === 0 ? (
        <p>No groups yet. Make the pairings first.</p>
      ) : (
        <div className="pr-alpha">
          {rows.map((r, i) => (
            <div key={i} className="pr-line">
              <span>
                {r.name}
                {r.hcp ? ` (${r.hcp})` : ""}
              </span>
              <span>{r.start}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
