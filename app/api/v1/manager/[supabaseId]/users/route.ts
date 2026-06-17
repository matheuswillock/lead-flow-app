import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  CreateUserSchema,
  UpdateUserSchema,
  AssociateOperatorSchema,
  DissociateOperatorSchema,
  type CreateUserRequest,
} from "./types";
import { getEmailService } from "@/lib/services/EmailService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link";
import { getFullUrl } from "@/lib/utils/app-url";
import { prisma } from "@/app/api/infra/data/prisma";
import {
  getTeamAccess,
  hasDelegatedUserCreationAccess,
} from "@/app/api/v1/utils/teamAccess";
import { NotificationType, UserRole } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { isManagerLikeRole } from "@/lib/roles";
import { incrementalBillingService } from "@/app/api/services/billing/IncrementalBillingService";
import { subscriptionCreditService } from "@/app/api/services/billing/SubscriptionCreditService";
import type { BillingOwnerProfile } from "@/app/api/services/billing/IIncrementalBillingService";
import { asaasApi, asaasFetch } from "@/lib/asaas";
import type { Prisma } from "@prisma/client";
import { isGoogleConnectionActive } from "@/lib/google/connection";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getTeamName(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });
  return team?.name || "Time";
}

async function getProfileLabel(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { fullName: true, email: true },
  });
  return profile?.fullName || profile?.email || "Usuário";
}

async function getBillingOwnerProfile(profileId: string): Promise<BillingOwnerProfile | null> {
  return prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      fullName: true,
      email: true,
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
      hasPermanentSubscription: true,
      timezone: true,
    },
  });
}

function resolveDelegatedPermissions(
  role: CreateUserRequest["role"],
  requestedPermissions: {
    canCreateAccountUsers?: boolean;
    canManageAccountTeams?: boolean;
    canTransferAccountLeads?: boolean;
  },
  options: {
    canManageDelegation: boolean;
  }
) {
  if (!options.canManageDelegation) {
    return {
      canCreateAccountUsers: false,
      canManageAccountTeams: false,
      canTransferAccountLeads: false,
    };
  }

  const isManagerLike = role === "manager" || role === "backoffice";

  return {
    canCreateAccountUsers: role === "manager" && requestedPermissions.canCreateAccountUsers === true,
    canManageAccountTeams: role === "manager" && requestedPermissions.canManageAccountTeams === true,
    canTransferAccountLeads: isManagerLike && requestedPermissions.canTransferAccountLeads === true,
  };
}

async function createUserRecords(
  args: {
    teamId: string;
    masterId: string;
    userData: CreateUserRequest;
    delegatedPermissions: {
      canCreateAccountUsers: boolean;
      canManageAccountTeams: boolean;
      canTransferAccountLeads: boolean;
    };
  },
  db: Prisma.TransactionClient | typeof prisma
) {
  const email = normalizeEmail(args.userData.email);

  const profile = await db.profile.create({
    data: {
      fullName: args.userData.name,
      email,
      role: args.userData.role as UserRole,
      functions: args.userData.functions ?? [],
      managerId: args.masterId,
      isMaster: false,
      hasPermanentSubscription: args.userData.hasPermanentSubscription ?? false,
      canCreateAccountUsers: args.delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: args.delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: args.delegatedPermissions.canTransferAccountLeads,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      profileIconId: true,
      profileIconUrl: true,
    },
  });

  const teamMemberRecord = await db.teamMember.create({
    data: {
      teamId: args.teamId,
      profileId: profile.id,
      role: args.userData.role as UserRole,
      functions: args.userData.functions ?? [],
    },
    select: {
      role: true,
      functions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { profile, teamMemberRecord };
}

async function finalizeUserCreation(args: {
  teamId: string;
  masterId: string;
  requesterProfileId: string;
  actorName: string;
  teamName: string;
  userData: CreateUserRequest;
  delegatedPermissions: {
    canCreateAccountUsers: boolean;
    canManageAccountTeams: boolean;
    canTransferAccountLeads: boolean;
  };
  profile: {
    id: string;
    fullName: string | null;
    email: string;
    profileIconId: string | null;
    profileIconUrl: string | null;
  };
  teamMemberRecord: {
    role: UserRole;
    functions: string[];
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  const { profile, teamMemberRecord } = args;
  const email = normalizeEmail(args.userData.email);

  // External API calls outside any transaction — no timeout risk
  try {
    const supabaseAdmin = createSupabaseAdmin();
    if (!supabaseAdmin) {
      throw new Error("Falha ao criar cliente Supabase Admin");
    }

    const redirectTo = getFullUrl("/set-password");

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          name: args.userData.name,
          invited: true,
          first_access: true,
        },
      },
    });

    if (linkError || !data?.properties?.action_link) {
      throw new Error("Erro ao gerar link de convite");
    }

    const supabaseUserId = data.user?.id;
    const inviteLink = buildSetPasswordEmailAuthLink(data, "invite");

    if (supabaseUserId) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { supabaseId: supabaseUserId },
      });
    }

    const requesterProfile = await prisma.profile.findUnique({
      where: { id: args.requesterProfileId },
      select: { fullName: true, email: true },
    });

    const emailService = getEmailService();
    await emailService.sendOperatorInviteEmail({
      operatorName: args.userData.name,
      operatorEmail: email,
      operatorRole: args.userData.role,
      managerName: requesterProfile?.fullName || requesterProfile?.email || "Manager",
      inviteUrl: inviteLink,
    });

    try {
      await notificationService.createTeamMembershipNotification({
        teamId: args.teamId,
        actorProfileId: args.requesterProfileId,
        actorName: args.actorName,
        teamName: args.teamName,
        recipientProfileId: profile.id,
        type: NotificationType.TEAM_MEMBER_ADDED,
      });
    } catch (notificationError) {
      console.error(
        "[ManagerUsersRoute][finalizeUserCreation] Erro ao criar notificação de membro adicionado:",
        notificationError
      );
    }
  } catch (inviteError) {
    console.error("[ManagerUsersRoute][finalizeUserCreation] Invite falhou:", {
      email,
      teamId: args.teamId,
      error: inviteError instanceof Error
        ? { message: inviteError.message, stack: inviteError.stack, name: inviteError.name }
        : inviteError,
    });
    await prisma.teamMember.delete({
      where: {
        teamId_profileId: {
          teamId: args.teamId,
          profileId: profile.id,
        },
      },
    });
    await prisma.profile.delete({ where: { id: profile.id } });
    throw new Error("Erro ao enviar convite. Tente novamente.");
  }

  return {
    id: profile.id,
    name: profile.fullName || args.userData.name,
    email: profile.email,
    role: teamMemberRecord.role.toLowerCase(),
    functions: teamMemberRecord.functions,
    profileIconId: profile.profileIconId,
    profileIconUrl: profile.profileIconUrl,
    managerId: args.masterId,
    canCreateAccountUsers: args.delegatedPermissions.canCreateAccountUsers,
    canManageAccountTeams: args.delegatedPermissions.canManageAccountTeams,
    canTransferAccountLeads: args.delegatedPermissions.canTransferAccountLeads,
    createdAt: teamMemberRecord.createdAt,
    updatedAt: teamMemberRecord.updatedAt,
  };
}

async function getPendingPaymentStatus(paymentId?: string | null) {
  if (!paymentId) {
    return null;
  }

  try {
    const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
      method: "GET",
    });
    return {
      paymentId,
      paymentStatus: payment?.status || "PENDING",
      paymentMethod: payment?.billingType || "UNDEFINED",
    };
  } catch (error) {
    console.error("[ManagerUsersRoute] Erro ao consultar pagamento pendente:", error);
    return {
      paymentId,
      paymentStatus: "PENDING",
      paymentMethod: "UNDEFINED",
    };
  }
}

/**
 * POST /api/v1/manager/[supabaseId]/users
 * Cria um novo manager ou operator no time ativo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!hasDelegatedUserCreationAccess(teamAccess.access)) {
      const output = new Output(
        false,
        [],
        ["Apenas o master ou um manager delegado pode adicionar usuários da conta"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const [actorName, teamName, requesterProfile] = await Promise.all([
      getProfileLabel(profileId),
      getTeamName(teamId),
      prisma.profile.findUnique({
        where: { id: profileId },
        select: { email: true },
      }),
    ]);

    const body = await request.json();

    let validatedData;
    try {
      validatedData = CreateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const email = normalizeEmail(validatedData.email);
    const canManageDelegation = isMaster;
    const delegatedPermissions = resolveDelegatedPermissions(validatedData.role, validatedData, {
      canManageDelegation,
    });

    if (
      !isMaster &&
      (validatedData.canCreateAccountUsers || validatedData.canManageAccountTeams || validatedData.canTransferAccountLeads)
    ) {
      const output = new Output(
        false,
        [],
        ["Apenas o master pode delegar permissões adicionais para managers"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const [existingProfile, existingPendingOperator, existingPendingAction, billingOwner] = await Promise.all([
      prisma.profile.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      }),
      prisma.pendingOperator.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          operatorCreated: false,
        },
        select: { id: true },
      }),
      prisma.pendingAction.findFirst({
        where: {
          actionType: "add_user",
          status: { in: ["pending", "failed"] },
          payload: {
            path: ["email"],
            equals: email,
          },
        },
        select: { id: true },
      }),
      getBillingOwnerProfile(managerId),
    ]);

    if (existingProfile || existingPendingOperator || existingPendingAction) {
      const output = new Output(false, [], ["Email já está em uso"], null);
      return NextResponse.json(output, { status: 409 });
    }

    if (!billingOwner) {
      const output = new Output(false, [], ["Conta master responsável pela cobrança não foi encontrada"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (billingOwner.hasPermanentSubscription) {
      const { profile, teamMemberRecord } = await createUserRecords(
        { teamId, masterId: managerId, userData: validatedData, delegatedPermissions },
        prisma
      );
      const createdUser = await finalizeUserCreation({
        teamId,
        masterId: managerId,
        requesterProfileId: profileId,
        actorName,
        teamName,
        userData: validatedData,
        delegatedPermissions,
        profile,
        teamMemberRecord,
      });

      const output = new Output(true, ["Usuário criado com sucesso"], [], createdUser);
      return NextResponse.json(output, { status: 200 });
    }

    const projectedBilling = await incrementalBillingService.projectBilling(managerId, {
      additionalUsers: 1,
    });

    if (projectedBilling.billingDelta <= 0) {
      // Transaction contains only fast DB ops — no external API calls
      const { profile, teamMemberRecord } = await prisma.$transaction(async (tx) => {
        await subscriptionCreditService.assertCapacityAvailable(tx, managerId, { users: 1 });
        return createUserRecords(
          { teamId, masterId: managerId, userData: validatedData, delegatedPermissions },
          tx
        );
      });

      // External calls run after tx commits — no timeout risk, no FK violation
      const createdUser = await finalizeUserCreation({
        teamId,
        masterId: managerId,
        requesterProfileId: profileId,
        actorName,
        teamName,
        userData: validatedData,
        delegatedPermissions,
        profile,
        teamMemberRecord,
      });

      const output = new Output(true, ["Usuário criado com sucesso"], [], createdUser);
      return NextResponse.json(output, { status: 200 });
    }

    const payload = {
      name: validatedData.name,
      email,
      role: validatedData.role,
      functions: validatedData.functions ?? [],
      teamId,
      requestedByProfileId: profileId,
      requestedByName: actorName,
      requestedByEmail: requesterProfile?.email || "",
      canCreateAccountUsers: delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: delegatedPermissions.canTransferAccountLeads,
      billingType: validatedData.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
      billingDelta: projectedBilling.billingDelta,
      targetRecurringTotal: projectedBilling.targetRecurringTotal,
    };

    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: managerId,
        teamId,
        actionType: "add_user",
        status: "pending",
        payload,
      },
      select: { id: true },
    });

    const proportionalData = await incrementalBillingService.calculateProportionalAmount(managerId, "user");
    const totalCharge = proportionalData.totalCharge ?? projectedBilling.billingDelta;

    await prisma.pendingAction.update({
      where: { id: pendingAction.id },
      data: {
        payload: {
          ...payload,
          billingDelta: proportionalData.billingDelta,
          totalCharge,
          remainingMonths: proportionalData.remainingMonths,
          maxInstallments: proportionalData.maxInstallments,
          monthlyPrice: proportionalData.billingDelta,
        },
      },
    });

    const checkoutUrl = getFullUrl(`/addon-checkout/${pendingAction.id}`);

    const emailService = getEmailService();
    await emailService.sendAddOnPendingPaymentEmail({
      masterName: billingOwner.fullName || billingOwner.email,
      masterEmail: billingOwner.email,
      addonType: "user",
      addonLabel: "Licença Usuário",
      addonDetail: `${validatedData.name} (${email})`,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
      checkoutUrl,
      requesterName: actorName,
      requesterEmail: requesterProfile?.email || "",
    });

    const output = new Output(true, ["Cobrança pendente criada. Um link de pagamento foi enviado."], [], {
      pendingActionId: pendingAction.id,
      checkoutUrl,
      billingType: payload.billingType,
      totalCharge,
      remainingMonths: proportionalData.remainingMonths,
    });

    return NextResponse.json(output, { status: 202 });
  } catch (error) {
    console.error("[ManagerUsersRoute][POST] Erro ao criar usuário:", {
      error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
    });
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * GET /api/v1/manager/[supabaseId]/users?role=MANAGER|OPERATOR
 * Lista usuários do time ativo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;
    const { searchParams } = new URL(request.url);
    const emailToCheck = searchParams.get("email");

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode acessar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (emailToCheck) {
      const normalizedEmail = normalizeEmail(emailToCheck);

      const existingProfile = await prisma.profile.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: { id: true },
      });
      const existingPending = await prisma.pendingOperator.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" }, operatorCreated: false },
        select: { id: true },
      });
      const existingPendingAction = await prisma.pendingAction.findFirst({
        where: {
          actionType: "add_user",
          status: { in: ["pending", "failed"] },
          payload: {
            path: ["email"],
            equals: normalizedEmail,
          },
        },
        select: { id: true },
      });

      if (existingProfile || existingPending || existingPendingAction) {
        const output = new Output(false, [], ["Email já está em uso"], { available: false });
        return NextResponse.json(output, { status: 409 });
      }

      const output = new Output(true, [], [], { available: true });
      return NextResponse.json(output, { status: 200 });
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconId: true,
            profileIconUrl: true,
            hasPermanentSubscription: true,
            googleConnection: {
              select: {
                refreshToken: true,
                revokedAt: true,
              },
            },
            canCreateAccountUsers: true,
            canManageAccountTeams: true,
            canTransferAccountLeads: true,
            _count: {
              select: {
                leadsAsAssignee: {
                  where: { teamId },
                },
                leadsAsCloser: {
                  where: { teamId, status: "scheduled" },
                },
              },
            },
          },
        },
      },
      orderBy: {
        profile: { fullName: "asc" },
      },
    });

    const totalManagers = teamMembers.filter((member) => isManagerLikeRole(member.role)).length;
    const totalOperators = teamMembers.filter((member) => member.role === "operator").length;

    const activeUsers = teamMembers
      .filter((member) => (isMaster ? true : member.profileId !== profileId))
      .map((member) => ({
        id: member.profile.id,
        name: member.profile.fullName || "Usuário",
        email: member.profile.email,
        role: member.role.toLowerCase(),
        functions: member.functions,
        profileIconId: member.profile.profileIconId,
        profileIconUrl: member.profile.profileIconUrl,
        managerId,
        canCreateAccountUsers: member.profile.canCreateAccountUsers,
        canManageAccountTeams: member.profile.canManageAccountTeams,
        canTransferAccountLeads: member.profile.canTransferAccountLeads,
        leadsCount: member.profile._count?.leadsAsAssignee ?? 0,
        meetingsCount: member.profile._count?.leadsAsCloser ?? 0,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        hasPermanentSubscription: member.profile.hasPermanentSubscription,
        googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
      }));

    const pendingAsUsers: any[] = [];
    if (isMaster || hasDelegatedUserCreationAccess(teamAccess.access)) {
      const [pendingOperators, pendingActions] = await Promise.all([
        prisma.pendingOperator.findMany({
          where: {
            teamId,
            operatorCreated: false,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.pendingAction.findMany({
          where: {
            teamId,
            actionType: "add_user",
            status: { in: ["pending", "failed"] },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      pendingAsUsers.push(
        ...pendingOperators.map((pending) => ({
          id: pending.id,
          name: pending.name,
          email: pending.email,
          role: String(pending.role).toLowerCase(),
          profileIconId: null,
          profileIconUrl: null,
          managerId,
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
          leadsCount: 0,
          meetingsCount: 0,
          createdAt: pending.createdAt,
          updatedAt: pending.updatedAt,
          isPending: true,
          googleCalendarConnected: false,
          pendingPayment: {
            id: pending.id,
            paymentId: pending.paymentId,
            paymentStatus: pending.paymentStatus,
            paymentMethod: pending.paymentMethod,
            operatorCreated: pending.operatorCreated,
            pendingActionId: null,
            checkoutUrl: null,
          },
        }))
      );

      const pendingActionsWithPayments = await Promise.all(
        pendingActions.map(async (action) => {
          const payload = (action.payload as any) || {};
          const payment =
            action.status === "failed"
              ? {
                  paymentId: action.paymentId || payload.paymentId || "",
                  paymentStatus: "FAILED",
                  paymentMethod: payload.billingType || "UNDEFINED",
                }
              : await getPendingPaymentStatus(action.paymentId || payload.paymentId || null);

          return {
            id: action.id,
            name: payload.name || "Usuário pendente",
            email: payload.email || "",
            role: String(payload.role || "operator").toLowerCase(),
            profileIconId: null,
            profileIconUrl: null,
            managerId,
            canCreateAccountUsers: payload.canCreateAccountUsers === true,
            canManageAccountTeams: payload.canManageAccountTeams === true,
            canTransferAccountLeads: payload.canTransferAccountLeads === true,
            leadsCount: 0,
            meetingsCount: 0,
            createdAt: action.createdAt,
            updatedAt: action.updatedAt,
            isPending: true,
            googleCalendarConnected: false,
            pendingPayment: {
              id: action.id,
              paymentId: payment?.paymentId || action.paymentId || "",
              paymentStatus: payment?.paymentStatus || "PENDING",
              paymentMethod: payment?.paymentMethod || payload.billingType || "UNDEFINED",
              operatorCreated: false,
              pendingActionId: action.id,
              checkoutUrl: getFullUrl(`/addon-checkout/${action.id}`),
            },
          };
        })
      );

      pendingAsUsers.push(...pendingActionsWithPayments);
    }

    const output = new Output(true, [], [], [...activeUsers, ...pendingAsUsers]);
    const responseWithStats = {
      ...output,
      stats: {
        totalOperators,
        totalManagers,
        totalUsers: totalManagers + totalOperators,
      },
    };

    return NextResponse.json(responseWithStats, { status: 200 });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/manager/[supabaseId]/users
 * Atualiza usuário ou associa/desassocia membro do time
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;
    const [actorName, teamName] = await Promise.all([
      getProfileLabel(profileId),
      getTeamName(teamId),
    ]);

    if (action === "associate") {
      let validatedData;
      try {
        validatedData = AssociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!isMaster) {
        const output = new Output(false, [], ["Apenas o master do time pode adicionar usuários"], null);
        return NextResponse.json(output, { status: 403 });
      }

      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_profileId: {
            teamId,
            profileId: validatedData.profileId,
          },
        },
      });

      if (existingMember) {
        const output = new Output(false, [], ["Usuário já pertence a este time"], null);
        return NextResponse.json(output, { status: 409 });
      }

      const newMember = await prisma.teamMember.create({
        data: {
          teamId,
          profileId: validatedData.profileId,
          role: (validatedData.role ?? "operator") as UserRole,
          functions: validatedData.functions ?? [],
        },
      });

      try {
        await notificationService.createTeamMembershipNotification({
          teamId,
          actorProfileId: profileId,
          actorName,
          teamName,
          recipientProfileId: validatedData.profileId,
          type: NotificationType.TEAM_MEMBER_ADDED,
        });
      } catch (notificationError) {
        console.error("[ManagerUsersRoute][PUT] Erro ao criar notificação de membro adicionado:", notificationError);
      }

      const output = new Output(true, ["Usuário adicionado ao time com sucesso"], [], newMember);
      return NextResponse.json(output, { status: 200 });
    }

    if (action === "dissociate") {
      let validatedData;
      try {
        validatedData = DissociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!isMaster) {
        const output = new Output(false, [], ["Apenas o master do time pode remover usuários"], null);
        return NextResponse.json(output, { status: 403 });
      }

      if (validatedData.profileId === managerId) {
        const output = new Output(false, [], ["Não é possível remover o master do time"], null);
        return NextResponse.json(output, { status: 400 });
      }

      try {
        await notificationService.createTeamMembershipNotification({
          teamId,
          actorProfileId: profileId,
          actorName,
          teamName,
          recipientProfileId: validatedData.profileId,
          type: NotificationType.TEAM_MEMBER_REMOVED,
        });
      } catch (notificationError) {
        console.error("[ManagerUsersRoute][PUT] Erro ao criar notificação de membro removido:", notificationError);
      }

      await prisma.teamMember.delete({
        where: {
          teamId_profileId: {
            teamId,
            profileId: validatedData.profileId,
          },
        },
      });

      const output = new Output(true, ["Usuário removido do time com sucesso"], [], null);
      return NextResponse.json(output, { status: 200 });
    }

    let validatedData;
    try {
      validatedData = UpdateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: validatedData.id,
        },
      },
    });

    if (!targetMember) {
      const output = new Output(false, [], ["Usuário não encontrado no time"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (!isMaster && validatedData.id === managerId) {
      const output = new Output(false, [], ["Você não pode editar o master do time"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (
      !isMaster &&
      (
        validatedData.canCreateAccountUsers !== undefined ||
        validatedData.canManageAccountTeams !== undefined ||
        validatedData.canTransferAccountLeads !== undefined
      )
    ) {
      const output = new Output(
        false,
        [],
        ["Apenas o master pode alterar permissões delegadas de managers"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    if (
      validatedData.id === profileId &&
      (
        validatedData.canCreateAccountUsers !== undefined ||
        validatedData.canManageAccountTeams !== undefined ||
        validatedData.canTransferAccountLeads !== undefined
      )
    ) {
      const output = new Output(
        false,
        [],
        ["Você não pode alterar as próprias permissões delegadas"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const nextDelegatedPermissions = resolveDelegatedPermissions(
      validatedData.role ?? (targetMember.role.toLowerCase() as CreateUserRequest["role"]),
      validatedData,
      { canManageDelegation: isMaster }
    );

    if (
      validatedData.name ||
      validatedData.email ||
      validatedData.role ||
      validatedData.functions ||
      validatedData.canCreateAccountUsers !== undefined ||
      validatedData.canManageAccountTeams !== undefined ||
      validatedData.canTransferAccountLeads !== undefined
    ) {
      await profileRepository.updateProfileById(validatedData.id, {
        ...(validatedData.name ? { fullName: validatedData.name } : {}),
        ...(validatedData.email ? { email: normalizeEmail(validatedData.email) } : {}),
        ...(validatedData.role ? { role: validatedData.role } : {}),
        ...(validatedData.functions ? { functions: validatedData.functions } : {}),
        canCreateAccountUsers: nextDelegatedPermissions.canCreateAccountUsers,
        canManageAccountTeams: nextDelegatedPermissions.canManageAccountTeams,
        canTransferAccountLeads: nextDelegatedPermissions.canTransferAccountLeads,
      });
    }

    if (
      validatedData.role ||
      validatedData.functions ||
      validatedData.canCreateAccountUsers !== undefined ||
      validatedData.canManageAccountTeams !== undefined ||
      validatedData.canTransferAccountLeads !== undefined
    ) {
      await prisma.teamMember.update({
        where: {
          teamId_profileId: {
            teamId,
            profileId: validatedData.id,
          },
        },
        data: {
          ...(validatedData.role ? { role: validatedData.role as UserRole } : {}),
          ...(validatedData.functions ? { functions: validatedData.functions } : {}),
        },
      });
    }

    const updatedMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: validatedData.id,
        },
      },
      include: {
        profile: {
          select: {
            fullName: true,
            email: true,
            profileIconId: true,
            profileIconUrl: true,
            canCreateAccountUsers: true,
            canManageAccountTeams: true,
            canTransferAccountLeads: true,
          },
        },
      },
    });

    const output = new Output(true, ["Usuário atualizado com sucesso"], [], {
      id: validatedData.id,
      name: updatedMember?.profile.fullName || validatedData.name,
      email: updatedMember?.profile.email,
      role: updatedMember?.role ? updatedMember.role.toLowerCase() : validatedData.role,
      functions: updatedMember?.functions ?? validatedData.functions,
      profileIconId: updatedMember?.profile.profileIconId,
      profileIconUrl: updatedMember?.profile.profileIconUrl,
      managerId,
      canCreateAccountUsers: updatedMember?.profile.canCreateAccountUsers ?? false,
      canManageAccountTeams: updatedMember?.profile.canManageAccountTeams ?? false,
      canTransferAccountLeads: updatedMember?.profile.canTransferAccountLeads ?? false,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao gerenciar usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/manager/[supabaseId]/users?userId=xxx
 * Remove um usuário do time ativo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId } = await params;

    let userId: string | null = null;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, profileId, teamMember, isMaster, managerId } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!isMaster) {
      const output = new Output(false, [], ["Apenas o master do time pode remover usuários"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const [actorName, teamName] = await Promise.all([
      getProfileLabel(profileId),
      getTeamName(teamId),
    ]);

    if (!userId) {
      const output = new Output(false, [], ["Parâmetro userId é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    if (userId === managerId) {
      const output = new Output(false, [], ["Você não pode remover o master do time"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const targetMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: userId,
        },
      },
    });

    if (!targetMember) {
      const output = new Output(false, [], ["Usuário não encontrado no time"], null);
      return NextResponse.json(output, { status: 404 });
    }

    try {
      await notificationService.createTeamMembershipNotification({
        teamId,
        actorProfileId: profileId,
        actorName,
        teamName,
        recipientProfileId: userId,
        type: NotificationType.TEAM_MEMBER_REMOVED,
      });
    } catch (notificationError) {
      console.error("[ManagerUsersRoute][DELETE] Erro ao criar notificação de membro removido:", notificationError);
    }

    await prisma.teamMember.delete({
      where: {
        teamId_profileId: {
          teamId,
          profileId: userId,
        },
      },
    });

    const output = new Output(true, ["Usuário removido do time com sucesso"], [], null);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
