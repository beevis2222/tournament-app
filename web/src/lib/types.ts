import { z } from "zod";
import type { RoundMode } from "@starter/scoring";

const percentList = z.array(z.number().min(0).max(100));

/** Mirror of the engine's TeamHandicapRule. */
const TeamHandicapRule = z.discriminatedUnion("method", [
  z.object({ method: z.literal("usga") }),
  z.object({
    method: z.literal("custom"),
    percents: z.object({ "2": percentList.optional(), "3": percentList.optional(), "4": percentList.optional() }),
  }),
  z.object({ method: z.literal("combined"), percent: z.number().min(0).max(100) }),
  z.object({ method: z.literal("none") }),
]);

export const EventSettings = z.object({
  holes: z.enum(["18", "front", "back"]).default("18"),
  rounds: z.number().int().min(1).max(4).default(1),
  teamSize: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  teamMode: z.enum(["listed", "balanced"]).default("balanced"),
  teamHandicap: TeamHandicapRule.default({ method: "usga" }),
  maxTeamHandicap: z.number().int().min(0).nullable().default(null),
  limits: z
    .object({
      cap: z.number().nullable().optional(),
      gap: z.number().nullable().optional(),
      gapMode: z.enum(["flag", "reduce"]).optional(),
    })
    .default({}),
  flights: z.number().int().min(1).max(6).default(1),
  flightNames: z.array(z.string()).default([]),
  start: z.enum(["shotgun", "teetimes"]).default("shotgun"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  interval: z.number().int().min(5).max(20).default(10),
  prizes: z.array(z.number().min(0)).default([150, 100, 50]),
});
export type EventSettings = z.infer<typeof EventSettings>;

export interface EventBundle {
  event: { id: string; name: string; date: string; status: "setup" | "live" | "final"; settings: EventSettings };
  course: { id: string; name: string; pars: number[]; si: number[] };
  tees: { id: string; name: string; rating: number; slope: number; pars: number[] | null; si: number[] | null }[];
  entries: {
    id: string;
    golferId: string;
    name: string;
    indexUsed: number;
    nh: boolean;
    teeId: string | null;
    alternate: boolean;
  }[];
  teams: {
    id: string;
    label: string;
    flight: number | null;
    status: "WD" | "DQ" | "NS" | null;
    sort: number;
    entryIds: string[];
  }[];
  rounds: { id: string; number: number; mode: RoundMode }[];
  groups: {
    id: string;
    roundId: string;
    startHole: string | null;
    startTime: string | null;
    label: string;
    sort: number;
    teamIds: string[];
  }[];
  scores: { roundId: string; teamId: string; hole: number; gross: number | null }[];
}
