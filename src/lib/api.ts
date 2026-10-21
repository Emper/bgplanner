import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGroupManager } from "@/lib/groupTypes";
import { getEventParticipation, type EventParticipation } from "@/lib/events";

// Las piezas de siempre de un handler de la API: sesión, cuerpo validado,
// permisos de grupo o evento… Cada `require*` lanza un ApiError con su
// status y su mensaje en español, y `apiHandler` lo convierte en la
// respuesta JSON. Así el handler se lee de arriba abajo sin un
// `if (!x) return NextResponse.json(...)` cada dos líneas.

export type Session = { userId: string; email: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

/** `{ error }` con su status, y lo que haga falta al lado (p. ej. un id). */
export function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Envuelve un handler: los ApiError salen como `{ error }` con su status y
 * lo demás sigue su curso (Next lo registra y devuelve un 500).
 */
export function apiHandler<Ctx>(
  fn: (request: NextRequest, ctx: Ctx) => Promise<Response>
) {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.message, err.extra);
      throw err;
    }
  };
}

// ── Sesión y roles ──────────────────────────────────────────────────────

export async function requireSession(request?: NextRequest): Promise<Session> {
  const session = await getSession(request);
  if (!session) throw new ApiError(401, "No autorizado");
  return session;
}

/**
 * Solo superadmins. A los demás se les contesta 404, no 403: el panel de
 * admin no existe para quien no lo es.
 */
export async function requireSuperadmin(request?: NextRequest): Promise<Session> {
  const session = await requireSession(request);
  if (!(await isSuperadmin(session))) throw new ApiError(404, "No encontrado");
  return session;
}

/**
 * Los crons de Vercel mandan `Authorization: Bearer <CRON_SECRET>`. Sin el
 * secreto configurado, en producción no se deja pasar a nadie (antes
 * cualquiera podía lanzarlos); en local sí, para poder probarlos a mano.
 */
export function requireCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] Falta CRON_SECRET: el cron no se ejecuta");
      throw new ApiError(401, "No autorizado");
    }
    return;
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new ApiError(401, "No autorizado");
  }
}

// ── Cuerpo de la petición ──────────────────────────────────────────────

/** El JSON del cuerpo, o 400 si no lo es. */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "La petición no es válida");
  }
}

/** El cuerpo validado con un schema de validations.ts, o 400 con su mensaje. */
export async function parseBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S
): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
  }
  return parsed.data;
}

// ── Grupos ─────────────────────────────────────────────────────────────

/**
 * La membresía de quien llama, o 403. Con `manager`, además tiene que ser
 * dueño o admin del grupo.
 */
export async function requireGroupMember(
  groupId: string,
  userId: string,
  { manager = false }: { manager?: boolean } = {}
) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new ApiError(403, "No eres miembro");
  if (manager && !isGroupManager(membership.role)) {
    throw new ApiError(403, "Solo los administradores del grupo pueden hacer esto");
  }
  return membership;
}

// ── Eventos ────────────────────────────────────────────────────────────

/**
 * Lo que puede hacer quien llama con un evento:
 * - `view`: verlo (público, o creador o asistente). Si no, 404: un evento
 *   privado no existe para quien no está invitado.
 * - `participate`: creador o asistente (fotos, crónicas, intereses), o 403.
 * - `manage`: creador o asistente admin (editar, juegos, invitación), o 403.
 */
export async function requireEventAccess(
  eventId: string,
  userId: string,
  need: "view" | "participate" | "manage" = "view"
): Promise<EventParticipation> {
  const p = await getEventParticipation(eventId, userId);
  if (!p || !p.canView) throw new ApiError(404, "Evento no encontrado");
  if (need === "participate" && !p.canParticipate) {
    throw new ApiError(403, "Apúntate al evento para poder hacer esto");
  }
  if (need === "manage" && !p.isAdmin) {
    throw new ApiError(403, "Solo quien organiza el evento puede hacer esto");
  }
  return p;
}

// ── Utilidades ─────────────────────────────────────────────────────────

/**
 * Paginación por cursor de los feeds: `limit` acotado y `cursor` como fecha.
 * Un valor raro en la URL cae al de por defecto en vez de llegar a Prisma.
 */
export function parsePage(
  searchParams: URLSearchParams,
  { defaultLimit = 30, max = 50 }: { defaultLimit?: number; max?: number } = {}
): { limit: number; cursor: Date | null } {
  const raw = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, max) : defaultLimit;
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? new Date(cursorParam) : null;
  return { limit, cursor: cursor && !Number.isNaN(cursor.getTime()) ? cursor : null };
}

/** Recorta la página pedida y dice desde dónde seguir. */
export function paginate<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

/** Un token para enlaces de invitación o para compartir: imposible de adivinar. */
export function newToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}
