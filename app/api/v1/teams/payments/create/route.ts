import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import prisma from "@/app/api/infra/data/prisma";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import { emailService } from "@/lib/services/EmailService";
import { getFullUrl } from "@/lib/utils/app-url";

const formatTeamName = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalizeBillingType = (value: unknown): "PIX" | "CREDIT_CARD" | null => {
  if (value === "PIX" || value === "CREDIT_CARD") return value
  return null
}

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
    const billingType = normalizeBillingType(body?.billingType) ?? "PIX"

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
          subscriptionEndDate: true,
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
      const newTeam = await prisma.team.create({
        data: {
          masterId: master.id,
          name: teamName,
        },
      });

      await prisma.teamMember.create({
        data: {
          profileId: requester.id,
          teamId: newTeam.id,
          role: teamMember.role,
          functions: teamMember.functions ?? [],
        },
      });

      await emailService.sendAddOnConfirmedEmail({
        masterName: master.fullName || master.email,
        masterEmail: master.email,
        addonType: "team",
        addonLabel: "Time adicional",
        addonDetail: teamName,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso sem cobrança adicional"], [], { created: true }),
        { status: 201 }
      );
    }

    if (await memberProBillingUseCase.shouldBypassIncrementalCharge(master.id)) {
      const newTeam = await prisma.team.create({
        data: {
          masterId: master.id,
          name: teamName,
        },
      });

      await prisma.teamMember.create({
        data: {
          profileId: requester.id,
          teamId: newTeam.id,
          role: teamMember.role,
          functions: teamMember.functions ?? [],
        },
      });

      await emailService.sendAddOnConfirmedEmail({
        masterName: master.fullName || master.email,
        masterEmail: master.email,
        addonType: "team",
        addonLabel: "Time adicional",
        addonDetail: teamName,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
      });

      await memberProBillingUseCase.syncUsageToSubscription(master.id, "add_team");

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso sem cobrança adicional"], [], { created: true }),
        { status: 201 }
      );
    }

    if (!master.subscriptionStatus || master.subscriptionStatus === "canceled") {
      return NextResponse.json(
        new Output(false, [], ["Master nao possui assinatura ativa"], null),
        { status: 400 }
      );
    }

    const isExternalSubscription = !master.asaasSubscriptionId;
    const subscriptionEnd = master.subscriptionEndDate ?? master.subscriptionNextDueDate;
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

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(master.id, "team");
    const { billingDelta, totalCharge } = proportionalData;

    // Bifurcação: se billingDelta = 0, criar time imediatamente
    if (billingDelta === 0) {
      const newTeam = await prisma.team.create({
        data: {
          masterId: master.id,
          name: teamName,
        },
      });

      await prisma.teamMember.create({
        data: {
          profileId: requester.id,
          teamId: newTeam.id,
          role: teamMember.role,
          functions: teamMember.functions ?? [],
        },
      });

      await emailService.sendAddOnConfirmedEmail({
        masterName: master.fullName || master.email,
        masterEmail: master.email,
        addonType: "team",
        addonLabel: "Time adicional",
        addonDetail: teamName,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso sem cobrança adicional"], [], { created: true }),
        { status: 201 }
      );
    }

    // billingDelta > 0: criar PendingAction e enviar email com link de checkout
    const pendingPayload = {
      teamName,
      billingType,
      requestedByProfileId: requester.id,
      requestedByName: requester.fullName || requester.email,
      requestedByEmail: requester.email,
      requestedByFunctions: requester.functions ?? teamMember.functions ?? [],
      billingDelta,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      maxInstallments: proportionalData.maxInstallments,
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

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`);

    await emailService.sendAddOnPendingPaymentEmail({
      masterName: master.fullName || master.email,
      masterEmail: master.email,
      addonType: "team",
      addonLabel: "Time adicional",
      addonDetail: teamName,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: requester.fullName || requester.email,
      requesterEmail: requester.email,
    });

    return NextResponse.json(
      new Output(true, ["Cobrança pendente criada. Um link de pagamento foi enviado."], [], {
        pendingActionId: pendingAction.id,
        checkoutUrl,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/v1/teams/payments/create] Erro:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro ao criar pagamento"], null),
      { status: 500 }
    );
  }
}

