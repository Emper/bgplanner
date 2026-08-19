import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getCatalogWithPreferences,
  setPreference,
} from "@/lib/notifications";
import { notificationPreferenceSchema } from "@/lib/validations";

/** Catálogo de avisos con los valores efectivos del usuario. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const types = await getCatalogWithPreferences(session.userId);
  return NextResponse.json({ types });
}

/** Guarda la preferencia de un tipo de aviso. */
export async function PUT(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = notificationPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type, email, push } = parsed.data;
  await setPreference(session.userId, type, { email, push });

  return NextResponse.json({ success: true, type, email, push });
}
