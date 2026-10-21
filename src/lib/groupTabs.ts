// Pestañas de la ficha de grupo (`?tab=`). Aparte para que las lean tanto el
// cliente como la página de servidor, que solo trae el feed si se abre la
// de actividad (la de por defecto).
export type GroupTab = "ranking" | "sessions" | "members" | "activity" | "gallery";

export function groupTabFromParam(tab: string | null | undefined): GroupTab {
  return tab === "ranking" || tab === "sessions" || tab === "members" || tab === "gallery" ? tab : "activity";
}
