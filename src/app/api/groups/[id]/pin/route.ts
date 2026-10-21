import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiHandler, parseBody, requireGroupMember, requireSession } from "@/lib/api";
import { groupPinSchema } from "@/lib/validations";

// Fijar el grupo arriba en tu lista: es tuyo, no del grupo (va en la membresía).
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireSession(request);
    const { id: groupId } = await params;
    const { pinned } = await parseBody(request, groupPinSchema);

    await requireGroupMember(groupId, session.userId);

    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: session.userId } },
      data: { pinned },
    });

    return NextResponse.json({ pinned });
  }
);
