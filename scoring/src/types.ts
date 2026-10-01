// Shapes the scoring engine works with. Only raw facts live here (handicap
// indexes, tees, gross strokes). Everything else is calculated.

export interface Tee {
  id: string;
  name: string;
  rating: number;
  slope: number;
  /** Only set when this tee has its own par per hole (18 numbers). */
  pars?: number[];
  /** Only set when this tee has its own stroke index (18 numbers). */
  si?: number[];
}

export interface Course {
  /** Par for holes 1-18 (index 0 = hole 1). */
  pars: number[];
  /** Stroke index for holes 1-18, 1 = hardest. */
  si: number[];
  /** The first tee is the default for players with no tee set. */
  tees: Tee[];
}

export interface Player {
  id: string;
  name: string;
  /** Handicap index. Plus handicaps are negative (+2.1 is -2.1). */
  index: number;
  /** "No handicap": course handicap counts as 0. */
  nh?: boolean;
  teeId?: string;
}

export type Status = "WD" | "DQ" | "NS";

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
  status?: Status;
  /** 0 = top flight. */
  flight?: number;
}

/** Which holes the event plays: all 18, front 9 or back 9. */
export type HolesSetting = "18" | "front" | "back";

/** Per-round override when weather hits. */
export type RoundMode = "full" | "front" | "back" | "called_off";

export interface HandicapLimits {
  /** Maximum handicap index. */
  cap?: number | null;
  /** Maximum gap between teammates' indexes. */
  gap?: number | null;
  /** "flag" only warns; "reduce" lowers the higher index to fit. */
  gapMode?: "flag" | "reduce";
}

/** One gross score per team per hole, or null if not entered yet. */
export type TeamCards = Record<string, (number | null)[]>;

/**
 * How a scramble team's handicap is figured. Percentages are whole numbers
 * (25 = 25%). Every method uses unrounded course handicaps, rounds half up at
 * the end, and halves the total first for a 9-hole round.
 *
 * - usga:     USGA weights, low to high. 4: 25/20/15/10, 3: 20/15/10, 2: 35/15. (Club default.)
 * - custom:   your own percentages, low to high, per team size. A team size
 *             with no list of its own uses the USGA weights for that size.
 * - combined: a percent of all players' course handicaps added together.
 * - none:     no handicaps. Gross only; the net board is hidden.
 */
export type TeamHandicapRule =
  | { method: "usga" }
  | { method: "custom"; percents: { 2?: number[]; 3?: number[]; 4?: number[] } }
  | { method: "combined"; percent: number }
  | { method: "none" };

export interface ScrambleEvent {
  /** Defaults to { method: "usga" }. */
  teamHandicap?: TeamHandicapRule;
  /** Most strokes any team gets in a round, after rounding. Empty = no limit. */
  maxTeamHandicap?: number | null;
  course: Course;
  players: Player[];
  teams: Team[];
  holes: HolesSetting;
  /** One entry per round. */
  rounds: RoundMode[];
  limits?: HandicapLimits;
  /** scores[round][teamId][hole] = team gross strokes. */
  scores: TeamCards[];
}
