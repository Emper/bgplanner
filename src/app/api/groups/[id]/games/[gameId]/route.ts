import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
    include: { game: { select: { name: true } } },
  });

  if (!groupGame) {
    return NextResponse.json(
      { error: "Juego no encontrado en este grupo" },
      { status: 404 }
    );
  }

  // Only the user who added the game or a group admin can delete it
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const isOwner = groupGame.addedById === session.userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Solo quien añadió el juego o el admin puede eliminarlo" },
      { status: 403 }
    );
  }

  // Deleting GroupGame cascades to votes (onDelete: Cascade on Vote)
  await prisma.groupGame.delete({
    where: { id: groupGame.id },
  });

  logActivity("game_removed", session.userId, { groupId, gameName: groupGame.game?.name });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, gameId } = await params;
  const body = await request.json();
  const { played, archived } = body;

  if (typeof played !== "boolean" && typeof archived !== "boolean") {
    return NextResponse.json({ error: "Campo 'played' o 'archived' requerido (boolean)" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
  }

  const groupGame = await prisma.groupGame.findUnique({
    where: { groupId_gameId: { groupId, gameId } },
    include: { game: { select: { name: true } } },
  });

  if (!groupGame) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  // Handle archive
  if (typeof archived === "boolean") {
    await prisma.groupGame.update({
      where: { id: groupGame.id },
      data: { archivedAt: archived ? new Date() : null },
    });
    logActivity("game_archived", session.userId, { groupId, gameName: groupGame.game.name });
    return NextResponse.json({ success: true });
  }

  // Update playedAt
  await prisma.groupGame.update({
    where: { id: groupGame.id },
    data: { playedAt: played ? new Date() : null },
  });

  // When marking as played, convert super votes to normal and notify users
  if (played) {
    const superVotes = await prisma.vote.findMany({
      where: { groupGameId: groupGame.id, type: "super" },
      include: { user: { select: { email: true, name: true } } },
    });

    if (superVotes.length > 0) {
      // Convert all super votes to normal
      await prisma.vote.updateMany({
        where: { groupGameId: groupGame.id, type: "super" },
        data: { type: "up" },
      });

      // Get group name for the email
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true },
      });

      // Send notification emails (fire and forget)
      for (const vote of superVotes) {
        resend.emails.send({
          from: "WeBoard <cesar@tiradacritica.es>",
          to: vote.user.email,
          subject: `Tu super voto en "${group?.name}" se ha liberado`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
              <h2 style="color: #f59e0b; margin-bottom: 16px;">WeBoard</h2>
              <p>¡Buenas noticias, ${vote.user.name || "jugador"}! 🎲</p>
              <p>El juego <strong style="color: #f59e0b;">"${groupGame.game.name}"</strong> en el grupo <strong>"${group?.name}"</strong> ha sido marcado como jugado.</p>
              <p>Tu super voto se ha convertido en un voto normal y <strong style="color: #f59e0b;">vuelves a tener tu super voto disponible</strong> para usarlo en otro juego del grupo.</p>
              <a href="${process.env.NEXT_PUBLIC_URL || "https://weboard-five.vercel.app"}/groups/${groupId}" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
                Ir al grupo
              </a>
            </div>
          `,
        }).catch(() => {}); // Don't fail if email fails
      }
    }
  }

  logActivity(played ? "game_marked_played" : "game_returned_pending", session.userId, { groupId, gameName: groupGame.game.name });

  return NextResponse.json({ success: true });
}
