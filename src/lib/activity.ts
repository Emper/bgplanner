import { prisma } from "./prisma";

export type ActivityType =
  | "group_created" | "group_joined" | "group_pinged" | "member_promoted" | "member_demoted"
  | "game_added" | "game_removed" | "game_marked_played" | "game_returned_pending" | "game_archived"
  | "vote_cast" | "vote_changed" | "vote_removed"
  | "session_created" | "session_updated" | "session_deleted" | "session_game_completed"
  | "event_created" | "event_updated" | "event_joined" | "event_left"
  | "event_game_added" | "event_interest_set";

const PUBLIC_TYPES = new Set<ActivityType>([
  "group_created",
  "group_joined",
  "event_created",
  "event_joined",
  "event_left",
  "session_created",
  "game_added",
]);

export function logActivity(
  type: ActivityType,
  userId: string,
  opts: { groupId?: string; eventId?: string; [key: string]: unknown } = {}
) {
  const { groupId, eventId, ...rest } = opts;
  const scope = PUBLIC_TYPES.has(type) ? "public" : "internal";
  // Fire and forget — never block the API response
  prisma.activityLog
    .create({
      data: {
        type,
        scope,
        userId,
        groupId: (groupId as string) || null,
        eventId: (eventId as string) || null,
        metadata: rest as Record<string, string | number | boolean | null>,
      },
    })
    .catch(() => {});
}

// ── Activity text templates ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Meta = Record<string, any>;

function voteEmoji(m: Meta): string {
  // Prefer numeric value (current schema); fall back to legacy "voteType" string
  // for activity entries written before the vote-value migration.
  if (typeof m.voteValue === "number") {
    if (m.voteValue >= 5) return "🔥";
    if (m.voteValue === 4) return "💖";
    if (m.voteValue === 3) return "🔥";
    if (m.voteValue === 2) return "✨";
    if (m.voteValue === 1) return "👍";
    if (m.voteValue < 0) return "👎";
    return "🙂";
  }
  if (m.voteType === "super") return "🔥";
  if (m.voteType === "down") return "👎";
  return "👍";
}

const TEMPLATES: Record<string, (m: Meta) => string> = {
  group_created: () => "creó el grupo",
  group_joined: () => "se unió al grupo",
  group_pinged: (m) => `convocó al grupo para votar 📯${m.recipientCount ? ` (${m.recipientCount} jugadores)` : ""}`,
  member_promoted: (m) => `hizo admin a ${m.targetName || "un miembro"}`,
  member_demoted: (m) => `quitó admin a ${m.targetName || "un miembro"}`,
  game_added: (m) => `añadió "${m.gameName || "un juego"}"`,
  game_removed: (m) => `quitó "${m.gameName || "un juego"}"`,
  game_marked_played: (m) => `marcó "${m.gameName || "un juego"}" como jugado`,
  game_returned_pending: (m) => `devolvió "${m.gameName || "un juego"}" a pendientes`,
  game_archived: (m) => `ocultó "${m.gameName || "un juego"}"`,
  vote_cast: (m) => `votó ${voteEmoji(m)} por "${m.gameName || "un juego"}"`,
  vote_changed: (m) => `cambió su voto en "${m.gameName || "un juego"}" a ${voteEmoji({ ...m, voteValue: m.toValue ?? m.voteValue, voteType: m.to ?? m.voteType })}`,
  vote_removed: (m) => `quitó su voto en "${m.gameName || "un juego"}"`,
  session_created: (m) => `creó la sesión${m.sessionName ? ` "${m.sessionName}"` : ""}`,
  session_updated: (m) => `actualizó la sesión${m.sessionName ? ` "${m.sessionName}"` : ""}`,
  session_deleted: () => "eliminó una sesión",
  session_game_completed: (m) => `completó "${m.gameName || "un juego"}" en una sesión`,
  event_created: (m) => `creó el evento "${m.eventName || ""}"`,
  event_updated: (m) => `editó el evento "${m.eventName || ""}"`,
  event_joined: (m) => `se apuntó al evento "${m.eventName || ""}"`,
  event_left: (m) => `se desapuntó del evento "${m.eventName || ""}"`,
  event_game_added: (m) => `añadió "${m.gameName || "un juego"}" al evento`,
  event_interest_set: (m) => `marcó interés en "${m.gameName || "un juego"}"`,
};

export function formatActivity(type: string, metadata: Meta): string {
  const template = TEMPLATES[type];
  return template ? template(metadata) : type;
}
