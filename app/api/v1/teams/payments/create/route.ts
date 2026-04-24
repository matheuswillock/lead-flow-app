import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";

const formatTeamName = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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
    const teamName = formatTeamName(body?.name);

    if (!teamName || teamName.length < 2) {
      return NextResponse.json(
        new Output(false, [], ["Nome do time deve ter pelo menos 2 caracteres"], null),
        { status: 400 }
      );
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { profileId, managerId, teamMember } = teamAccess.access;
    if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode criar times"], null),
        { status: 403 }
      );
    }

    const [requester, master] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          fullName: true,
          email: true,
          functions: true,
        },
      }),
      prisma.profile.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          hasPermanentSubscription: true,
          cpfCnpj: true,
          phone: true,
          postalCode: true,
          address: true,
          addressNumber: true,
          neighborhood: true,
          complement: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          timezone: true,
        },
      }),
    ]);

    if (!requester || !master) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), {
        status: 404,
      });
    }

    if (master.hasPermanentSubscription) {
      return NextResponse.json(
        new Output(false, [], ["Assinatura permanente ativa. Nenhum pagamento é necessário."], null),
        { status: 400 }
      );
    }

    if (!master.subscriptionStatus || master.subscriptionStatus === "canceled") {
      return NextResponse.json(
        new Output(false, [], ["Master nao possui assinatura ativa"], null),
        { status: 400 }
      );
    }

    const projectedBilling = await incrementalBillingService.projectBilling(master.id, {
      additionalTeams: 1,
    });
    const amount = projectedBilling.billingDelta;

    if (amount <= 0) {
      return NextResponse.json(
        new Output(false, [], ["Nenhuma cobrança adicional é necessária."], null),
        { status: 400 }
      );
    }

    if (!master.cpfCnpj) {
      return NextResponse.json(
        new Output(false, [], ["CPF/CNPJ do master nao informado"], null),
        { status: 400 }
      );
    }

    const pendingPayload = {
      name: teamName,
      requestedByProfileId: requester.id,
      requestedByName: requester.fullName || requester.email,
      requestedByEmail: requester.email,
      requestedByFunctions: requester.functions ?? teamMember.functions ?? [],
      billingDelta: projectedBilling.billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
    };

    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: master.id,
        actionType: "create_team",
        status: "pending",
        payload: pendingPayload,
      },
      select: { id: true },
    });

    try {
      const charge = await incrementalBillingService.createIncrementalCharge({
        master,
        pendingActionId: pendingAction.id,
        amount,
        description: `Time adicional - ${teamName}`,
      });

      await prisma.pendingAction.update({
        where: { id: pendingAction.id },
        data: {
          paymentId: charge.paymentId,
          payload: {
            ...pendingPayload,
            paymentId: charge.paymentId,
            paymentStatus: charge.paymentStatus,
            billingType: charge.billingType,
          },
        },
      });

      const result: any = {
        pendingActionId: pendingAction.id,
        paymentId: charge.paymentId,
        paymentStatus: charge.paymentStatus || "PENDING",
        billingType: charge.billingType,
        amount: charge.amount,
        dueDate: charge.dueDate,
      };

      if (charge.pix) {
        result.pix = charge.pix;
      }

      if (charge.boleto) {
        result.boleto = charge.boleto;
      }

      return NextResponse.json(new Output(true, ["Pagamento criado com sucesso"], [], result), {
        status: 201,
      });
    } catch (chargeError: any) {
      await prisma.pendingAction.update({
        where: { id: pendingAction.id },
        data: {
          status: "failed",
          payload: {
            ...pendingPayload,
            paymentStatus: "FAILED",
          },
        },
      });

      return NextResponse.json(
        new Output(false, [], [chargeError.message || "Erro ao criar pagamento"], null),
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[POST /api/v1/teams/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}

