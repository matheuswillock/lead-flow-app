import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import prisma from "@/app/api/infra/data/prisma";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { emailService } from "@/lib/services/EmailService";
import { isManagerLikeRole } from "@/lib/roles";
import { getFullUrl } from "@/lib/utils/app-url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managerId, operatorData, teamId } = body;
    const billingType = body?.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX"

    if (!managerId || !operatorData) {
      return NextResponse.json(
        new Output(false, [], ["Dados incompletos"], null),
        { status: 400 }
      );
    }

    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["Team ID é obrigatório"], null),
        { status: 400 }
      );
    }

    if (!operatorData.name || !operatorData.email) {
      return NextResponse.json(
        new Output(false, [], ["Nome e e-mail do operador sao obrigatorios"], null),
        { status: 400 }
      );
    }

    const manager = await prisma.profile.findUnique({
      where: { supabaseId: managerId },
    });

    if (!manager || !isManagerLikeRole(manager.role)) {
      return NextResponse.json(
        new Output(false, [], ["Manager nao encontrado"], null),
        { status: 404 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true },
    });

    if (!team) {
      return NextResponse.json(
        new Output(false, [], ["Time nao encontrado"], null),
        { status: 404 }
      );
    }

    if (team.masterId !== manager.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master do time pode adicionar operadores"], null),
        { status: 403 }
      );
    }

    if (!manager.subscriptionStatus || manager.subscriptionStatus === "canceled") {
      return NextResponse.json(
        new Output(false, [], ["Manager nao possui assinatura ativa"], null),
        { status: 400 }
      );
    }

    const isExternalSubscription = !manager.asaasSubscriptionId;
    const subscriptionEnd = manager.subscriptionEndDate ?? manager.subscriptionNextDueDate;
    if (
      isExternalSubscription &&
      subscriptionEnd &&
      subscriptionEnd.getTime() < Date.now()
    ) {
      return NextResponse.json(
        new Output(false, [], ["Assinatura externa expirada. Solicite renovação ao backoffice."], null),
        { status: 400 }
      );
    }

    const existingUser = await prisma.profile.findFirst({
      where: { email: operatorData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        new Output(false, [], ["Email ja esta em uso"], null),
        { status: 400 }
      );
    }

    const existingPending = await prisma.pendingOperator.findFirst({
      where: { email: operatorData.email, operatorCreated: false },
    });

    if (existingPending) {
      return NextResponse.json(
        new Output(false, [], ["Ja existe um operador pendente para este email"], null),
        { status: 400 }
      );
    }

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(manager.id, "user");
    const { billingDelta, totalCharge } = proportionalData;

    // Bifurcação: se billingDelta = 0, criar operador imediatamente
    if (billingDelta === 0) {
      const newOperator = await prisma.profile.create({
        data: {
          supabaseId: crypto.randomUUID(),
          email: operatorData.email,
          fullName: operatorData.name,
          role: operatorData.role || "operator",
          functions: operatorData.functions ?? [],
        },
      });

      await prisma.teamMember.create({
        data: {
          profileId: newOperator.id,
          teamId: team.id,
          role: operatorData.role || "operator",
        },
      });

      await emailService.sendAddOnConfirmedEmail({
        masterName: manager.fullName || manager.email,
        masterEmail: manager.email,
        addonType: "user",
        addonLabel: "Licença Usuário",
        addonDetail: `${operatorData.name} (${operatorData.email})`,
      });

      return NextResponse.json(
        new Output(true, ["Usuário criado com sucesso sem cobrança adicional"], [], { created: true }),
        { status: 201 }
      );
    }

    // billingDelta > 0: criar PendingAction e enviar email com link de checkout
    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: manager.id,
        teamId: team.id,
        actionType: "add_user",
        status: "pending",
        payload: {
          operatorName: operatorData.name,
          operatorEmail: operatorData.email,
          operatorRole: operatorData.role || "operator",
          operatorFunctions: operatorData.functions ?? [],
          billingType,
          billingDelta,
          totalCharge,
          remainingMonths: proportionalData.remainingMonths,
          maxInstallments: proportionalData.maxInstallments,
        },
      },
    });

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`);

    await emailService.sendAddOnPendingPaymentEmail({
      masterName: manager.fullName || manager.email,
      masterEmail: manager.email,
      addonType: "user",
      addonLabel: "Licença Usuário",
      addonDetail: `${operatorData.name} (${operatorData.email})`,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
    });

    return NextResponse.json(
      new Output(true, ["Cobrança pendente criada. Um link de pagamento foi enviado."], [], {
        pendingActionId: pendingAction.id,
        checkoutUrl,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/v1/operators/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}
