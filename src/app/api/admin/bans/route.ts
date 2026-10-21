import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, apiHandler, parseBody, requireSuperadmin } from "@/lib/api";
import { readmitSchema } from "@/lib/validations";

// Lista de expulsados de /admin/reports (pestaña «Expulsados») y readmitir:
// quitar un email de la lista para que pueda volver a crear una cuenta. La
// cuenta borrada al expulsar no vuelve; empezaría de cero.

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);

  const bans = await prisma.bannedEmail.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ bans }, { headers: { "Cache-Control": "no-store" } });
});

export const DELETE = apiHandler(async (request: NextRequest) => {
  await requireSuperadmin(request);
  const { email } = await parseBody(request, readmitSchema);

  const { count } = await prisma.bannedEmail.deleteMany({ where: { email } });
  if (count === 0) throw new ApiError(404, "Ese email no estaba expulsado");
  return NextResponse.json({ ok: true });
});
