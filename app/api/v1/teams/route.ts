import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
import { subscriptionCreditService } from "@/app/api/services/billing/SubscriptionCreditService";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";
import { getFullUrl } from "@/lib/utils/app-url";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import { getAccountSubscriptionStatus } from "@/lib/subscription/isAccountSubscriptionActive";
import { findActiveAccountBannedMasterIds } from "@/lib/account/isAccountMasterBanned";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const CreateTeamSchema = z.object({
  name: z.string().min(2, "Nome do time deve ter pelo menos 2 caracteres"),
});

async function getPendingPaymentStatus(paymentId?: string | null) {
  if (!paymentId) {
    return null;
  }
  try {
    const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "GET" });
    return {
      paymentId,
      paymentStatus: payment?.status || "PENDING",
      paymentMethod: payment?.billingType || "UNDEFINED",
    };
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamsRoute][GET] Erro ao consultar pagamento pendente:", error);
    const is404 = (error as any)?.statusCode === 404;
    return {
      paymentId,
      paymentStatus: is404 ? "NOT_FOUND" : "PENDING",
      paymentMethod: "UNDEFINED",
    };
  }
}

async function createTeamForAccount(args: {
  teamName: string;
  masterId: string;
  requesterProfileId: string;
  masterFunctions: ("SDR" | "CLOSER")[];
  requesterFunctions: ("SDR" | "CLOSER")[];
  tx?: Prisma.TransactionClient;
}) {
  const db = args.tx ?? prisma;
  const team = await db.team.create({
    data: {
      name: args.teamName,
      masterId: args.masterId,
      isDefault: false,
    },
  });

  await db.teamMember.upsert({
    where: {
      teamId_profileId: {
        teamId: team.id,
        profileId: args.masterId,
      },
    },
    update: {
      role: "manager",
    },
    create: {
      teamId: team.id,
      profileId: args.masterId,
      role: "manager",
      functions: args.masterFunctions,
    },
  });

  if (args.requesterProfileId !== args.masterId) {
    await db.teamMember.upsert({
      where: {
        teamId_profileId: {
          teamId: team.id,
          profileId: args.requesterProfileId,
        },
      },
      update: {
        role: "manager",
        functions: args.requesterFunctions,
      },
      create: {
        teamId: team.id,
        profileId: args.requesterProfileId,
        role: "manager",
        functions: args.requesterFunctions,
      },
    });
  }

  return team;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseIdHeader = request.headers.get("x-supabase-user-id");
    const supabaseIdLegacy = request.headers.get("supabaseid");
    const supabaseIdQuery = new URL(request.url).searchParams.get("supabaseId");
    const supabaseId = supabaseIdHeader || supabaseIdLegacy || supabaseIdQuery;

    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Supabase ID is required"], null),
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, activeTeamId: true }
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Profile not found"], null),
        { status: 404 }
      );
    }

    const memberships = await prisma.teamMember.findMany({
      where: { profileId: profile.id },
      include: {
        team: {
          include: {
            master: {
              select: {
                id: true,
                fullName: true,
                email: true,
                sponsorMasterId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }
    });

    const pendingActions = await prisma.pendingAction.findMany({
      where: {
        masterId: profile.id,
        actionType: "create_team",
        status: { in: ["pending", "failed"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        paymentId: true,
        payload: true,
        status: true,
        createdAt: true,
      },
    });

    const pendingByName = new Map<string, {
      id: string;
      paymentId: string;
      paymentStatus: string;
      paymentMethod: string;
      checkoutUrl: string;
    }>();

    await Promise.all(
      pendingActions.map(async (action) => {
        const payload = (action.payload as Record<string, unknown>) || {};
        const teamName = String(payload.teamName ?? "").trim();
        if (!teamName || pendingByName.has(teamName)) {
          return;
        }

        const payment =
          action.status === "failed"
            ? {
                paymentId: action.paymentId || "",
                paymentStatus: "FAILED",
                paymentMethod: payload.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
              }
            : await getPendingPaymentStatus(action.paymentId);

        pendingByName.set(teamName, {
          id: action.id,
          paymentId: payment?.paymentId || "",
          paymentStatus: payment?.paymentStatus || "PENDING",
          paymentMethod: payment?.paymentMethod || "UNDEFINED",
          checkoutUrl: getFullUrl(`/addon-checkout/${action.id}`),
        });
      })
    );

    const subscriptionByMasterId = new Map<string, boolean>();
    const uniqueMasterIds = [...new Set(memberships.map((item) => item.team.masterId))];
    await Promise.all(
      uniqueMasterIds.map(async (masterId) => {
        const status = await getAccountSubscriptionStatus(masterId);
        subscriptionByMasterId.set(masterId, status.isActive);
      })
    );

    const activeTeamIds = new Set(memberships.map((m) => m.team.id));

    const memberTeamIds = memberships.map((m) => m.team.id);
    const transferRoutes = await prisma.teamTransferRoute.findMany({
      where: { sourceTeamId: { in: memberTeamIds } },
      select: { sourceTeamId: true },
    });
    const teamsWithRoutes = new Set(transferRoutes.map((r) => r.sourceTeamId));

    const sponsoredTeams = await prisma.team.findMany({
      where: {
        master: {
          sponsorMasterId: profile.id,
        },
      },
      include: {
        master: {
          select: {
            id: true,
            fullName: true,
            email: true,
            sponsorMasterId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const masterId of sponsoredTeams.map((t) => t.masterId)) {
      if (!subscriptionByMasterId.has(masterId)) {
        const status = await getAccountSubscriptionStatus(masterId);
        subscriptionByMasterId.set(masterId, status.isActive);
      }
    }

    const bannedMasterIds = await findActiveAccountBannedMasterIds([
      ...subscriptionByMasterId.keys(),
    ]);

    const activeTeams = memberships.map((membership) => {
      const accountMasterId = membership.team.masterId;
      const accountSubscriptionActive = subscriptionByMasterId.get(accountMasterId) ?? false;
      const accountMasterBanned = bannedMasterIds.has(accountMasterId);
      const isAccessible = accountSubscriptionActive && !accountMasterBanned;

      return {
        id: membership.team.id,
        name: membership.team.name,
        masterId: accountMasterId,
        accountMasterId,
        accountName: membership.team.master.fullName ?? membership.team.master.email,
        isOwnAccount: accountMasterId === profile.id,
        isAssociateAccount: Boolean(membership.team.master.sponsorMasterId),
        sponsorMasterId: membership.team.master.sponsorMasterId ?? null,
        associateAccountName:
          membership.team.master.sponsorMasterId
            ? (membership.team.master.fullName ?? membership.team.master.email)
            : null,
        isAccessible,
        accountSubscriptionActive,
        accountMasterBanned,
        isDefault: membership.team.isDefault,
        role: membership.role,
        functions: membership.functions,
        canCreateAccountUsers: membership.canCreateAccountUsers,
        canManageAccountTeams: membership.canManageAccountTeams,
        canTransferAccountLeads: membership.canTransferAccountLeads,
        canViewAllTeams: membership.canViewAllTeams,
        hasTransferRoutes: teamsWithRoutes.has(membership.team.id),
        membershipCreatedAt: membership.createdAt,
        isPending: false,
        pendingPayment: pendingByName.get(membership.team.name) ?? null,
      };
    });

    const sponsoredTeamRows = sponsoredTeams
      .filter((team) => !activeTeamIds.has(team.id))
      .map((team) => {
        const accountMasterId = team.masterId;
        const accountSubscriptionActive = subscriptionByMasterId.get(accountMasterId) ?? false;
        const accountMasterBanned = bannedMasterIds.has(accountMasterId);
        const isAccessible = accountSubscriptionActive && !accountMasterBanned;
        const associateAccountName = team.master.fullName ?? team.master.email;

        return {
          id: team.id,
          name: team.name,
          masterId: accountMasterId,
          accountMasterId,
          accountName: associateAccountName,
          isOwnAccount: false,
          isAssociateAccount: true,
          sponsorMasterId: team.master.sponsorMasterId ?? profile.id,
          associateAccountName,
          isAccessible,
          accountSubscriptionActive,
          accountMasterBanned,
          isDefault: team.isDefault,
          role: "backoffice" as const,
          functions: [] as string[],
          canCreateAccountUsers: false,
          canManageAccountTeams: true,
          canTransferAccountLeads: false,
          canViewAllTeams: false,
          hasTransferRoutes: false,
          membershipCreatedAt: team.createdAt,
          isPending: false,
          pendingPayment: null,
        };
      });

    const activeTeamsMerged = [...activeTeams, ...sponsoredTeamRows];

    const pendingTeamRows = pendingActions
      .filter((action) => {
        const payload = (action.payload as Record<string, unknown>) || {};
        const teamName = String(payload.teamName ?? "").trim();
        if (!teamName) return false;
        return !activeTeamsMerged.some((team) => team.name.trim() === teamName);
      })
      .map((action) => {
        const payload = (action.payload as Record<string, unknown>) || {};
        const teamName = String(payload.teamName ?? "").trim();
        const billingType = String(payload.billingType ?? "PIX").toUpperCase();
        const paymentStatus =
          action.status === "failed"
            ? "FAILED"
            : pendingByName.get(teamName)?.paymentStatus || "PENDING";
        const paymentMethod =
          action.status === "failed"
            ? billingType
            : pendingByName.get(teamName)?.paymentMethod || billingType;

        return {
          id: action.id,
          name: teamName,
          masterId: profile.id,
          isDefault: false,
          role: "manager",
          functions: [],
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
          canViewAllTeams: false,
          hasTransferRoutes: false,
          membershipCreatedAt: action.createdAt,
          isPending: true,
          pendingPayment: {
            id: action.id,
            paymentId: action.paymentId || "",
            paymentStatus,
            paymentMethod,
            checkoutUrl: getFullUrl(`/addon-checkout/${action.id}`),
          },
        };
      });

    const teams = [...activeTeamsMerged, ...pendingTeamRows];

    let activeTeamId = profile.activeTeamId;
    const currentTeam = teams.find((team) => team.id === activeTeamId);
    const currentIsAccessible =
      currentTeam &&
      !currentTeam.isPending &&
      ("isAccessible" in currentTeam ? currentTeam.isAccessible : true);

    if (!currentIsAccessible) {
      const fallbackTeam = activeTeamsMerged.find((team) => team.isAccessible);
      if (fallbackTeam) {
        activeTeamId = fallbackTeam.id;
        await prisma.profile.update({
          where: { id: profile.id },
          data: { activeTeamId: fallbackTeam.id },
        });
      } else {
        activeTeamId = null;
      }
    }

    return NextResponse.json(
      new Output(true, [], [], { teams, activeTeamId }),
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Error in GET /api/v1/teams:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
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

    const [profile, billingOwner] = await Promise.all([
      prisma.profile.findUnique({
        where: { supabaseId },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.profile.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          hasPermanentSubscription: true,
          teamMemberships: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { functions: true },
          },
        },
      }),
    ]);

    if (!profile || !billingOwner) {
      return NextResponse.json(
        new Output(false, [], ["Perfil não encontrado"], null),
        { status: 404 }
      );
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = CreateTeamSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const masterFunctions = billingOwner.teamMemberships[0]?.functions ?? [];
    const requesterFunctions = teamMember.functions ?? [];

    if (billingOwner.hasPermanentSubscription) {
      const team = await createTeamForAccount({
        teamName: validatedData.name,
        masterId: managerId,
        requesterProfileId: profileId,
        masterFunctions,
        requesterFunctions,
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    if (await memberProBillingUseCase.shouldBypassIncrementalCharge(managerId)) {
      const team = await createTeamForAccount({
        teamName: validatedData.name,
        masterId: managerId,
        requesterProfileId: profileId,
        masterFunctions,
        requesterFunctions,
      });

      await memberProBillingUseCase.syncUsageToSubscription(managerId, "add_team");

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    const projectedBilling = await incrementalBillingService.projectBilling(managerId, {
      additionalTeams: 1,
    });
    const delta = projectedBilling.billingDelta;

    if (delta <= 0) {
      const team = await prisma.$transaction(async (tx) => {
        await subscriptionCreditService.assertCapacityAvailable(tx, managerId, { teams: 1 });
        return createTeamForAccount({
          teamName: validatedData.name,
          masterId: managerId,
          requesterProfileId: profileId,
          masterFunctions,
          requesterFunctions,
          tx,
        });
      });

      return NextResponse.json(
        new Output(true, ["Time criado com sucesso"], [], { teamId: team.id }),
        { status: 201 }
      );
    }

    return NextResponse.json(
      new Output(true, ["Pagamento necessário para criar time"], [], {
        requiresPayment: true,
        amount: delta,
        teamName: validatedData.name,
      }),
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Error in POST /api/v1/teams:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
