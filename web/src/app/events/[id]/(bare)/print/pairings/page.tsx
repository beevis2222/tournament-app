import PrintBar from "@/components/PrintBar";
import PrintHeader from "@/components/PrintHeader";
import { hcpText, printGroups } from "@/lib/printData";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

export default async function PairingsPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, round, roundLabel, back } = await loadForPrint(id, (await searchParams).round);
  const groups = round ? printGroups(bundle, round.id) : [];
  const title = ["Pairings", roundLabel].filter(Boolean).join(", ");
  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      <PrintHeader name={bundle.event.name} date={bundle.event.date} title={title} />
      {groups.length === 0 ? (
        <p>No groups yet. Make the pairings first.</p>
      ) : (
        <div className="pr-grid">
          {groups.map((g) => (
            <div key={g.id} className="pr-box">
              <div className="pr-start">{g.start}</div>
              {g.label && <div className="pr-sub">{g.label}</div>}
              {g.teams.map((t) => (
                <div key={t.id}>
                  <div className="pr-sub">
                    {t.label}
                    {t.hcp !== null ? ` (${t.hcp})` : ""}
                  </div>
                  {t.players.map((p, i) => (
                    <div key={i} className="pr-line">
                      <span>{p.name}</span>
                      <span>{hcpText(p.hcp) ? `(${hcpText(p.hcp)})` : ""}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
