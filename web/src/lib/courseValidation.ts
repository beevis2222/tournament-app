export type CourseInput = { name: string; pars: number[]; si: number[] };
export type TeeInput = { name: string; rating: number; slope: number; pars: number[] | null; si: number[] | null };
export type Errors = Record<string, string>;

export const SI_MESSAGE = "Stroke index must use each number 1 to 18 once.";
export const SLOPE_MESSAGE = "Slope must be between 55 and 155.";
export const RATING_MESSAGE = "Rating must be between 50 and 80.";
export const PAR_MESSAGE = "Each par must be 3, 4, 5 or 6.";

function holes(pars: number[], si: number[], errors: Errors) {
  if (pars.length !== 18 || pars.some((p) => !Number.isInteger(p) || p < 3 || p > 6)) errors.pars = PAR_MESSAGE;
  const sorted = [...si].sort((a, b) => a - b);
  if (si.length !== 18 || sorted.some((n, i) => n !== i + 1)) errors.si = SI_MESSAGE;
}

export function validateCourse(c: CourseInput): Errors {
  const errors: Errors = {};
  if (!c.name.trim()) errors.name = "Give the course a name.";
  holes(c.pars, c.si, errors);
  return errors;
}

export function validateTee(t: TeeInput): Errors {
  const errors: Errors = {};
  if (!t.name.trim()) errors.name = "Give the tee a name.";
  if (!Number.isFinite(t.rating) || t.rating < 50 || t.rating > 80) errors.rating = RATING_MESSAGE;
  if (!Number.isFinite(t.slope) || !Number.isInteger(t.slope) || t.slope < 55 || t.slope > 155) errors.slope = SLOPE_MESSAGE;
  if (t.pars || t.si) holes(t.pars ?? [], t.si ?? [], errors);
  return errors;
}
