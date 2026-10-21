import "../../../../print.css";

/** Print pages live outside the app shell so only the sheet itself is printed. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="pr-root">{children}</div>;
}
