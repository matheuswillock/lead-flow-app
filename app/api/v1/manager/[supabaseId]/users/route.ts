import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import {
  CreateUserSchema,
  UpdateUserSchema,
  AssociateOperatorSchema,
  DissociateOperatorSchema,
} from "./types";
import {
  getTeamAccess,
  hasDelegatedUserCreationAccess,
} from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { managerAccountUsersUseCase } from "@/app/api/useCases/managerAccountUsers/ManagerAccountUsersUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { deleteSubscriptionStateSnapshotsForProfiles } from "@/lib/billing/deleteSubscriptionStateSnapshots";

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
      hasUnlimitedUsers: true,
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
    canViewAllTeams?: boolean;
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
      canViewAllTeams: false,
    };
  }

  const isManagerLike = role === "manager" || role === "backoffice";

  return {
    canCreateAccountUsers: role === "manager" && requestedPermissions.canCreateAccountUsers === true,
    canManageAccountTeams: role === "manager" && requestedPermissions.canManageAccountTeams === true,
    canTransferAccountLeads: isManagerLike && requestedPermissions.canTransferAccountLeads === true,
    canViewAllTeams: isManagerLike && requestedPermissions.canViewAllTeams === true,
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
      canViewAllTeams: boolean;
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
      canCreateAccountUsers: args.delegatedPermissions.canCreateAccountUsers,
      canManageAccountTeams: args.delegatedPermissions.canManageAccountTeams,
      canTransferAccountLeads: args.delegatedPermissions.canTransferAccountLeads,
      canViewAllTeams: args.delegatedPermissions.canViewAllTeams,
    },
    select: {
      role: true,
      functions: true,
      createdAt: true,
      updatedAt: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      canTransferAccountLeads: true,
      canViewAllTeams: true,
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
    canViewAllTeams: boolean;
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
    await deleteSubscriptionStateSnapshotsForProfiles(prisma, [profile.id]);
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
    canViewAllTeams: args.delegatedPermissions.canViewAllTeams,
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
    rethrowIfPrerenderInterrupted(error);
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

    const body = await request.json();

    let validatedData;
    try {
      validatedData = CreateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const { output, status } = await managerAccountUsersUseCase.createAccountUser({
      ctx: { teamId, profileId, managerId, isMaster },
      userData: validatedData,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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
  await connection();

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
      const { output, status } = await managerAccountUsersUseCase.checkEmailAvailability(emailToCheck);
      return NextResponse.json(output, { status });
    }

    const { output, stats, status } = await managerAccountUsersUseCase.listAccountUsers({
      ctx: { teamId, profileId, managerId, isMaster },
      canListPendingUsers: isMaster || hasDelegatedUserCreationAccess(teamAccess.access),
    });

    const responseWithStats = {
      ...output,
      stats,
    };

    return NextResponse.json(responseWithStats, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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
    const ctx = { teamId, profileId, managerId, isMaster };

    if (action === "associate") {
      let validatedData;
      try {
        validatedData = AssociateOperatorSchema.parse(body);
      } catch (validationError: any) {
        const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
        const output = new Output(false, [], errors, null);
        return NextResponse.json(output, { status: 400 });
      }

      const { output, status } = await managerAccountUsersUseCase.associateTeamMember({
        ctx,
        userData: validatedData,
      });

      return NextResponse.json(output, { status });
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

      const { output, status } = await managerAccountUsersUseCase.dissociateTeamMember({
        ctx,
        userData: validatedData,
      });

      return NextResponse.json(output, { status });
    }

    let validatedData;
    try {
      validatedData = UpdateUserSchema.parse(body);
    } catch (validationError: any) {
      const errors = validationError.errors?.map((err: any) => err.message) || [validationError.message];
      const output = new Output(false, [], errors, null);
      return NextResponse.json(output, { status: 400 });
    }

    const { output, status } = await managerAccountUsersUseCase.updateAccountUser({
      ctx,
      userData: validatedData,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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

    const { output, status } = await managerAccountUsersUseCase.removeAccountUser({
      ctx: { teamId, profileId, managerId, isMaster },
      userId,
    });

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao excluir usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
