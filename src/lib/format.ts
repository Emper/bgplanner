/** "4 abr 2026" */
export function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
  });
}

/** "sábado, 4 de abril de 2026" (no time) */
export function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
