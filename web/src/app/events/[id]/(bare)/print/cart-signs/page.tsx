import PrintBar from "@/components/PrintBar";
import { cartSets, printGroups } from "@/lib/printData";
import { loadForPrint, type PrintParams, type PrintSearch } from "../load";

export default async function CartSignsPrint({ params, searchParams }: { params: PrintParams; searchParams: PrintSearch }) {
  const { id } = await params;
  const { bundle, round, roundLabel, back } = await loadForPrint(id, (await searchParams).round);
  const signs = cartSets(round ? printGroups(bundle, round.id) : []);
  return (
    <main className="pr-page">
      <PrintBar backHref={back} />
      {signs.length === 0 ? (
        <p>No groups yet. Make the pairings first.</p>
      ) : (
        <div className="pr-signs">
          {signs.map((s) => (
            <div key={s.cart} className="pr-sign">
              <div className="pr-sign-start">{s.start}</div>
              <div className="pr-sign-cart">Cart {s.cart}</div>
              <div className="pr-sign-ev">{[bundle.event.name, roundLabel].filter(Boolean).join(", ")}</div>
              <div className="pr-sign-team">{s.teams.join(" & ")}</div>
              {s.players.map((p, i) => (
                <div key={i} className="pr-sign-name">
                  {p.name}
                  {p.hcp ? <span> ({p.hcp})</span> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
