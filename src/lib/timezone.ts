/**
 * Utilidades de fecha en hora de Madrid.
 *
 * Los crons de Vercel se programan en UTC, pero los avisos tienen que caer a
 * una hora sensata para quien los recibe. Estas funciones traducen entre las
 * dos cosas teniendo en cuenta el cambio de hora, sin dependencias.
 *
 * Extraídas de `daily-review-digest` para que las comparta el cron de
 * recordatorios de evento.
 */

export const TZ = "Europe/Madrid";

export interface MadridParts {
  y: number;
  mo: number; // 1-12
  d: number;
  h: number;
}

export function madridParts(date: Date): MadridParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // "24" a medianoche en algunos runtimes → normalizar a 0.
  const h = get("hour") % 24;
  return { y: get("year"), mo: get("month"), d: get("day"), h };
}

/** Instante UTC correspondiente a la medianoche local de Madrid de (y, mo, d). */
export function madridMidnightUTC(y: number, mo: number, d: number): Date {
  const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const p = madridParts(new Date(guess));
  const asIfUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, 0, 0);
  const offset = asIfUTC - guess; // ms que hay que restar para pasar de local a UTC
  return new Date(guess - offset);
}
