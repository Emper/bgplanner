import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, newToken, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { inviteLinkToggleSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

const LINK_SELECT = { inviteCode: true, inviteEnabled: true } as const;

// POST — genera un enlace nuevo (el anterior deja de valer)
export const POST = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  await requireGroupMember(groupId, session.userId, { manager: true });

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: newToken(), inviteEnabled: true },
    select: LINK_SELECT,
  });

  return NextResponse.json(group);
});

// PATCH — activa o desactiva el enlace
export const PATCH = apiHandler(async (request: NextRequest, { params }: Ctx) => {
  const session = await requireSession(request);
  const { id: groupId } = await params;

  await requireGroupMember(groupId, session.userId, { manager: true });
  const { enabled } = await parseBody(request, inviteLinkToggleSchema);

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { inviteEnabled: enabled },
    select: LINK_SELECT,
  });

  return NextResponse.json(group);
});
