import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, requireSuperadmin } from "@/lib/api";
import { describeReportTarget } from "@/lib/moderation";
import { AUTO_HIDE_REPORTS, REPORT_TARGET_TYPES, type ReportTargetType } from "@/lib/reports";
import { displayName, profileHref } from "@/lib/users";

const PERSON = { id: true, slug: true, name: true, displayName: true, avatarUrl: true } as const;
const CLOSED_LIMIT = 100;

function person(u: { id: string; slug: string | null; name: string | null; displayName: string | null; avatarUrl: string | null } | null) {
  if (!u) return null;
  return { id: u.id, name: displayName(u), avatarUrl: u.avatarUrl, href: profileHref(u) };
}

// Cola de denuncias de /admin/reports, agrupadas por lo denunciado: diez
// personas que denuncian el mismo hilo son una sola fila con diez motivos.
// ?status=pending (por defecto) o ?status=closed (las últimas revisadas).
export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

  const closed = request.nextUrl.searchParams.get("status") === "closed";
  const [reports, pendingCount] = await Promise.all([
    prisma.report.findMany({
      where: closed ? { status: { in: ["resolved", "dismissed"] } } : { status: "pending" },
      orderBy: closed ? { resolvedAt: "desc" } : { createdAt: "desc" },
      take: closed ? CLOSED_LIMIT : undefined,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        text: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: PERSON },
        targetUser: { select: PERSON },
        resolvedBy: { select: PERSON },
      },
    }),
    prisma.report.count({ where: { status: "pending" } }),
  ]);

  const groups = new Map<string, typeof reports>();
  for (const r of reports) {
    if (!REPORT_TARGET_TYPES.includes(r.targetType as ReportTargetType)) continue;
    const key = `${r.targetType}:${r.targetId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const items = await Promise.all(
    [...groups.values()].map(async (rs) => {
      const first = rs[0];
      const type = first.targetType as ReportTargetType;
      const target = await describeReportTarget(type, first.targetId).catch(() => null);
      const pending = rs.filter((r) => r.status === "pending").length;
      return {
        // Cualquiera de las denuncias sirve para actuar sobre todas.
        reportId: first.id,
        targetType: type,
        targetId: first.targetId,
        target: target ?? { authorId: null, preview: null, imageUrl: null, href: null, context: null, gone: true },
        author: person(first.targetUser),
        autoHidden: (type === "thread" || type === "reply") && pending >= AUTO_HIDE_REPORTS,
        status: first.status,
        resolvedAt: first.resolvedAt,
        resolvedBy: person(first.resolvedBy),
        reports: rs.map((r) => ({
          id: r.id,
          reason: r.reason,
          text: r.text,
          createdAt: r.createdAt,
          reporter: person(r.reporter),
        })),
      };
    })
  );

  return NextResponse.json(
    { items, pendingCount },
    { headers: { "Cache-Control": "no-store" } }
  );
});
