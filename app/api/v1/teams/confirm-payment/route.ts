import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { pendingActionUseCase } from "@/app/api/useCases/pendingActions/PendingActionUseCase";

/**
 * POST /api/v1/teams/confirm-payment
 * Confirma o pagamento e aplica a pending action create_team.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = body?.paymentId as string | undefined;

    if (!paymentId) {
      return NextResponse.json(
        new Output(false, [], ["ID do pagamento é obrigatório"], null),
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, isMaster: true, managerId: true, activeTeamId: true },
    });

    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), {
        status: 404,
      });
    }

    const activeMembership = profile.activeTeamId
      ? await prisma.teamMember.findUnique({
          where: {
            teamId_profileId: {
              teamId: profile.activeTeamId,
              profileId: profile.id,
            },
          },
          select: { role: true, canManageAccountTeams: true },
        })
      : null;

    const canConfirmTeamPayment =
      profile.isMaster ||
      (activeMembership?.role === "manager" && activeMembership.canManageAccountTeams === true);

    if (!canConfirmTeamPayment) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode confirmar pagamento de time"], null),
        { status: 403 }
      );
    }

    const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
      method: "GET",
    });

    const status = payment?.status as string | undefined;
    if (status !== "CONFIRMED" && status !== "RECEIVED") {
      return NextResponse.json(
        new Output(false, [], ["Pagamento ainda não foi confirmado"], null),
        { status: 400 }
      );
    }

    let action = await prisma.pendingAction.findFirst({
      where: { paymentId },
      select: { id: true, masterId: true, status: true },
    });

    const externalReference = payment?.externalReference as string | undefined;
    if (!action && externalReference?.startsWith("pending-action-")) {
      const actionId = externalReference.replace("pending-action-", "");
      action = await prisma.pendingAction.findUnique({
        where: { id: actionId },
        select: { id: true, masterId: true, status: true },
      });
    }

    if (!action) {
      return NextResponse.json(
        new Output(false, [], ["Ação pendente não encontrada"], null),
        { status: 404 }
      );
    }

    const billingOwnerId = profile.isMaster ? profile.id : profile.managerId;

    if (action.masterId !== billingOwnerId) {
      return NextResponse.json(new Output(false, [], ["Ação não pertence a este master"], null), {
        status: 403,
      });
    }

    if (action.status === "canceled") {
      return NextResponse.json(new Output(false, [], ["Ação cancelada"], null), {
        status: 400,
      });
    }

    const result = await pendingActionUseCase.applyPendingActionByPaymentId(paymentId);
    return NextResponse.json(result, { status: result.isValid ? 201 : 400 });
  } catch (error: any) {
    console.error("[POST /api/v1/teams/confirm-payment] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}

