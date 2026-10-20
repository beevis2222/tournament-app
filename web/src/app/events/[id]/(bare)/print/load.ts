import { notFound } from "next/navigation";
import { EVENT_NOT_FOUND, loadEvent } from "@/lib/db/events";
import { pickRound, roundText } from "@/lib/printData";

/** Loads the event for a print page and picks the round from ?round=N. */
export async function loadForPrint(id: string, roundParam?: string) {
  let bundle;
  try {
    bundle = await loadEvent(id);
  } catch (e) {
    if (e instanceof Error && e.message === EVENT_NOT_FOUND) notFound();
    throw e;
  }
  const round = pickRound(bundle, roundParam);
  return { bundle, round, roundLabel: round ? roundText(bundle, round.number) : "", back: `/events/${id}/print` };
}

export type PrintSearch = Promise<{ round?: string }>;
export type PrintParams = Promise<{ id: string }>;
