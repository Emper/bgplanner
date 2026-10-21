// Fechas, duraciones y tiempos relativos, siempre en español.
//
// Zona horaria: en el navegador, la de quien mira (si estás en Canarias, la
// hora de Canarias). En el servidor no hay "quien mira" y Vercel corre en
// UTC, así que ahí se usa la de la app: si no, un evento a las 00:30 salía
// con el día anterior en las páginas pintadas en servidor.

/** La zona de la app: la de los eventos y la de lo que se pinta en servidor. */
export const APP_TZ = "Europe/Madrid";

function tz(): string | undefined {
  return typeof window === "undefined" ? APP_TZ : undefined;
}

/** "4 abr 2026" */
export function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz(),
  });
}

/** "sábado, 4 de abril de 2026, 13:30" */
export function formatDateFull(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz(),
  });
}

/** "sábado, 4 de abril de 2026" (no time) */
export function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz(),
  });
}

/** "2h 30min" or "45min" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas", "hace 4 meses", "hace 1 año" */
export function formatRelativeShort(dateStr: string | Date) {
  const then = typeof dateStr === "string" ? new Date(dateStr).getTime() : dateStr.getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `hace ${w} ${w === 1 ? "semana" : "semanas"}`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `hace ${m} ${m === 1 ? "mes" : "meses"}`;
  }
  const y = Math.floor(days / 365);
  return `hace ${y} ${y === 1 ? "año" : "años"}`;
}

/**
 * Valor para un <input type="datetime-local">: la hora local de quien edita.
 * Con toISOString() a secas saldría en UTC y, al guardar (se lee como hora
 * local), el evento se movería una o dos horas cada vez.
 */
export function toDateTimeLocalInput(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** "ahora", "hace 5 min", "hace 3 h", y a partir de un día como formatRelativeShort */
export function formatRelativeTime(dateStr: string | Date) {
  const then = typeof dateStr === "string" ? new Date(dateStr).getTime() : dateStr.getTime();
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return formatRelativeShort(dateStr);
}

/** "marzo de 2026" */
export function formatMonthYear(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: tz(),
  });
}

/**
 * Para listas apretadas (feed, avisos): "ahora", "hace 5 min", "hace 3 h",
 * "hace 2 d" y, pasada una semana, la fecha corta ("4 abr").
 */
export function formatRelativeCompact(dateStr: string | Date) {
  const then = new Date(dateStr);
  const diff = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return then.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: tz() });
}
