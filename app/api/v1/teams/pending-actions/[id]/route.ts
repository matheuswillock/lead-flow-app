import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";

/**
 * DELETE /api/v1/teams/pending-actions/[id]
 * Cancela uma pending action relacionada a criacao de time.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(new Output(false, [], ["ID é obrigatório"], null), {
        status: 400,
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, role: true, managerId: true, isMaster: true },
    });

    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), {
        status: 404,
      });
    }

    const action = await prisma.pendingAction.findUnique({
      where: { id },
      select: { id: true, masterId: true, status: true, actionType: true },
    });

    if (!action) {
      return NextResponse.json(new Output(false, [], ["Ação pendente não encontrada"], null), {
        status: 404,
      });
    }

    const billingOwnerId = profile.isMaster ? profile.id : profile.managerId;
    const canManagePendingAction =
      profile.isMaster || profile.role === "manager";

    if (!canManagePendingAction || action.masterId !== billingOwnerId) {
      return NextResponse.json(new Output(false, [], ["Ação não pertence a este master"], null), {
        status: 403,
      });
    }

    if (action.status === "applied") {
      return NextResponse.json(new Output(false, [], ["Ação já aplicada"], null), {
        status: 400,
      });
    }

    await prisma.pendingAction.update({
      where: { id },
      data: { status: "canceled" },
    });

    return NextResponse.json(new Output(true, ["Ação cancelada com sucesso"], [], null), {
      status: 200,
    });
  } catch (error: any) {
    console.error("[DELETE /api/v1/teams/pending-actions] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}

