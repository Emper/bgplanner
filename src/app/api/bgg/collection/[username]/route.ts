import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchBggCollection } from "@/lib/bgg";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { username } = await params;

  try {
    const collection = await fetchBggCollection(username);
    return NextResponse.json(collection);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al obtener colección";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
