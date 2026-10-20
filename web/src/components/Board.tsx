import { formatMoney } from "@/lib/money";
import type { BoardView, FlightView } from "@/lib/boards";

function title(kind: BoardView["kind"]) {
  return kind === "gross" ? "Gross" : "Net";
}

function BoardTable({ board }: { board: BoardView }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 6px" }}>{title(board.kind)}</h3>
      <table className="list">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Team</th>
            <th className="num">To par</th>
            <th className="num">Thru</th>
            <th className="num">Gross</th>
            <th className="num">Net</th>
          </tr>
        </thead>
        <tbody>
          {board.rows.map((r) => (
            <tr key={r.teamId}>
              <td>{r.pos}</td>
              <td>
                {r.team}
                <div className="players">{r.players.join(", ")}</div>
              </td>
              <td className="num">{r.toPar}</td>
              <td className="num">{r.thru}</td>
              <td className="num">{r.gross ?? ""}</td>
              <td className="num">{r.net ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Gross and net boards side by side, one block per flight (no heading when the whole field is one board). */
export function Board({ flights }: { flights: FlightView[] }) {
  if (flights.every((f) => f.boards.every((b) => b.rows.length === 0))) {
    return <p className="muted">No teams yet. Make teams first.</p>;
  }
  return (
    <>
      {flights.map((f) => (
        <section key={f.name ?? "all"} style={{ marginBottom: 28 }}>
          {f.name && <h2 style={{ marginBottom: 8 }}>{f.name}</h2>}
          <div className="boards">
            {f.boards.map((b) => (
              <BoardTable key={b.kind} board={b} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Prize winners for each flight and board. A team that wins on both boards is listed on both. */
export function Winners({ flights }: { flights: FlightView[] }) {
  return (
    <>
      {flights.map((f) => (
        <section key={f.name ?? "all"} style={{ marginBottom: 20 }}>
          {f.name && <h3 style={{ marginBottom: 6 }}>{f.name}</h3>}
          <div className="boards">
            {f.boards.map((b) => {
              const winners = b.rows.filter((r) => r.prize !== null);
              return (
                <div key={b.kind}>
                  <h4 style={{ margin: "0 0 4px" }}>{title(b.kind)}</h4>
                  {winners.length === 0 ? (
                    <p className="muted">No prizes yet.</p>
                  ) : (
                    <table className="list">
                      <tbody>
                        {winners.map((r) => (
                          <tr key={r.teamId}>
                            <td>{r.pos}</td>
                            <td>
                              {r.team}
                              <div className="players">{r.players.join(", ")}</div>
                            </td>
                            <td className="num prize">{formatMoney(r.prize as number)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
