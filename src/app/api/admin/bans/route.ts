import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readmitSchema } from "@/lib/validations";

// Lista de expulsados de /admin/reports (pestaña «Expulsados») y readmitir:
// quitar un email de la lista para que pueda volver a crear una cuenta. La
// cuenta borrada al expulsar no vuelve; empezaría de cero.

async function guard(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  if (!(await isSuperadmin(session))) {
    return { error: NextResponse.json({ error: "No encontrado" }, { status: 404 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const { error } = await guard(request);
  if (error) return error;

  const bans = await prisma.bannedEmail.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ bans }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const { error } = await guard(request);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = readmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { count } = await prisma.bannedEmail.deleteMany({ where: { email: parsed.data.email } });
  if (count === 0) {
    return NextResponse.json({ error: "Ese email no estaba expulsado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
