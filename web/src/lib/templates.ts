import type { EventSettings } from "@/lib/types";

export type Template = {
  id: string;
  name: string;
  desc: string;
  settings: Partial<EventSettings>;
  available: boolean;
};

/** Names and descriptions follow the prototype's BUILTIN_TPLS. Only scramble templates work in piece 1. */
export const TEMPLATES: Template[] = [
  { id: "b-champ", name: "Club championship", desc: "54 holes, net stroke play, 3 flights", settings: {}, available: false },
  { id: "b-match", name: "Match play championship", desc: "Gross brackets, 3 flights", settings: {}, available: false },
  { id: "b-mm", name: "Member-member", desc: "9-hole matches worth 10 points, round robin, 2 flights", settings: {}, available: false },
  { id: "b-mg", name: "Member-guest", desc: "Two-man better ball, 36 holes, 2 flights", settings: {}, available: false },
  {
    id: "b-outing",
    name: "Charity outing",
    desc: "4-person scramble, shotgun",
    settings: {
      teamSize: 4,
      rounds: 1,
      flights: 1,
      start: "shotgun",
      startTime: "13:00",
      teamHandicap: { method: "none" },
    },
    available: true,
  },
  { id: "b-skins", name: "Weekly skins game", desc: "Net skins, $20 a player", settings: {}, available: false },
  { id: "b-stable", name: "Stableford day", desc: "Net Stableford points, 2 flights", settings: {}, available: false },
  { id: "blank", name: "Blank scramble", desc: "A scramble with the usual settings", settings: {}, available: true },
];
