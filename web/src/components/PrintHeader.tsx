/** Plain heading at the top of every printed sheet: event, date and what the sheet is. */
export default function PrintHeader({ name, date, title }: { name: string; date: string; title: string }) {
  const [y, m, d] = date.split("-").map(Number);
  const pretty =
    y && m && d
      ? new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : date;
  return (
    <header className="pr-head">
      <div>
        <div className="pr-event">{name || "Untitled event"}</div>
        <div className="pr-date">{pretty}</div>
      </div>
      <div className="pr-title">{title}</div>
    </header>
  );
}
