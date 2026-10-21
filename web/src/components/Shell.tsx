"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Step } from "@/lib/progress";

type Props = { eventId: string; name: string; subtitle: string; steps: Step[]; children: React.ReactNode };

const TABS = [
  { key: "event", label: "Event", sections: ["details", "course", "field", "teams"] },
  { key: "pairings", label: "Pairings", sections: ["pairings"] },
  { key: "scoring", label: "Scoring", sections: ["cards", "board", "finish"] },
  { key: "print", label: "Print", sections: ["print"] },
];

const SECTION_LABEL: Record<string, string> = {
  details: "Details",
  course: "Course & tees",
  field: "Field",
  teams: "Teams",
  pairings: "Pairings",
  cards: "Enter cards",
  board: "Leaderboard",
  finish: "Finish",
  print: "Print",
};

export default function Shell({ eventId, name, subtitle, steps, children }: Props) {
  const base = `/events/${eventId}`;
  const section = usePathname().split("/")[3] ?? "details";
  const tab = TABS.find((t) => t.sections.includes(section)) ?? TABS[0];
  const firstUndone = steps.find((s) => !s.done);

  return (
    <div className="wrap">
      <header className="shell-head">
        <div className="brand">
          <svg viewBox="0 0 14 18" aria-hidden="true">
            <path d="M2 1v17" stroke="currentColor" strokeWidth="2" />
            <path d="M3 1l10 4-10 4z" fill="var(--flag)" />
          </svg>
          Starter
        </div>
        <div className="hdrow">
          <h1>{name || "Untitled event"}</h1>
          <Link className="evbtn" href="/events">Events</Link>
        </div>
        <p className="sub">{subtitle}</p>
        <div className="progress" aria-label="Event progress">
          {steps.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className={`${s.done ? "done" : ""} ${firstUndone?.key === s.key ? "now" : ""}`}
            >
              <span className="ck">{s.done ? "✓" : ""}</span>
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${base}/${t.sections[0]}`}
            aria-current={t.key === tab.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab.sections.length > 1 && (
        <div className="subnav">
          {tab.sections.map((s) => (
            <Link key={s} href={`${base}/${s}`} aria-current={s === section ? "page" : undefined}>
              {SECTION_LABEL[s]}
            </Link>
          ))}
        </div>
      )}
      <main className="shell-main">{children}</main>
    </div>
  );
}
