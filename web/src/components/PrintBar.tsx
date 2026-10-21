"use client";

import Link from "next/link";

/** Print and Back buttons for a print page. Hidden when printing. */
export default function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="pr-bar">
      <Link href={backHref}>Back</Link>
      <button type="button" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
