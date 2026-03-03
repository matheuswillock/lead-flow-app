import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { CreateUserSchema, UpdateUserSchema, AssociateOperatorSchema, DissociateOperatorSchema } from "./types";
import { getEmailService } from "@/lib/services/EmailService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getFullUrl } from "@/lib/utils/app-url";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { NotificationType, UserRole } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";

async function getTeamMasterId(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { masterId: true },
  });

  return team?.masterId ?? null;
}

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

    const { teamId, profileId, teamMember } = teamAccess.access;
    if (teamMember.role !== "manager") {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const masterId = await getTeamMasterId(teamId);
    if (!masterId) {
      const output = new Output(false, [], ["Time não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (masterId !== profileId) {
      const output = new Output(false, [], ["Apenas o master do time pode adicionar usuários"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const [actorName, teamName] = await Promise.all([
      getProfileLabel(profileId),
      getTeamName(teamId),
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

    const existingProfile = await prisma.profile.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingProfile) {
      const output = new Output(false, [], ["Email já está em uso"], null);
      return NextResponse.json(output, { status: 409 });
    }

    const profile = await prisma.profile.create({
      data: {
        fullName: validatedData.name,
        email,
        role: validatedData.role as UserRole,
        functions: validatedData.functions ?? [],
        managerId: masterId,
        isMaster: false,
        hasPermanentSubscription: validatedData.hasPermanentSubscription ?? false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileIconUrl: true,
      },
    });

    const teamMemberRecord = await prisma.teamMember.create({
      data: {
        teamId,
        profileId: profile.id,
        role: validatedData.role as UserRole,
        functions: validatedData.functions ?? [],
      },
      select: {
        role: true,
        functions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    try {
      await notificationService.createTeamMembershipNotification({
        teamId,
        actorProfileId: profileId,
        actorName,
        teamName,
        recipientProfileId: profile.id,
        type: NotificationType.TEAM_MEMBER_ADDED,
      });
    } catch (notificationError) {
      console.error("[ManagerUsersRoute][POST] Erro ao criar notificação de membro adicionado:", notificationError);
    }

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
            name: validatedData.name,
            invited: true,
            first_access: true,
          },
        },
      });

      if (linkError || !data?.properties?.action_link) {
        throw new Error("Erro ao gerar link de convite");
      }

      const supabaseUserId = (data as any)?.user?.id as string | undefined;
      const inviteLink = data.properties.action_link;

      if (supabaseUserId) {
        await prisma.profile.update({
          where: { id: profile.id },
          data: { supabaseId: supabaseUserId },
        });
      }

      const requesterProfile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: { fullName: true, email: true },
      });

      const emailService = getEmailService();
      await emailService.sendOperatorInviteEmail({
        operatorName: validatedData.name,
        operatorEmail: email,
        operatorRole: validatedData.role,
        managerName: requesterProfile?.fullName || requesterProfile?.email || "Manager",
        inviteUrl: inviteLink,
      });
    } catch (_inviteError) {
      await prisma.teamMember.delete({
        where: {
          teamId_profileId: {
            teamId,
            profileId: profile.id,
          },
        },
      });

      await prisma.profile.delete({ where: { id: profile.id } });

      const failureOutput = new Output(false, [], ["Erro ao enviar convite. Tente novamente."], null);
      return NextResponse.json(failureOutput, { status: 500 });
    }

    const output = new Output(true, ["Usuário criado com sucesso"], [], {
      id: profile.id,
      name: profile.fullName || validatedData.name,
      email: profile.email,
      role: teamMemberRecord.role.toLowerCase(),
      functions: teamMemberRecord.functions,
      profileIconUrl: profile.profileIconUrl,
      managerId: masterId,
      createdAt: teamMemberRecord.createdAt,
      updatedAt: teamMemberRecord.updatedAt,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
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

    const { teamId, profileId, teamMember } = teamAccess.access;
    if (teamMember.role !== "manager") {
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

      if (existingProfile || existingPending) {
        const output = new Output(false, [], ["Email já está em uso"], { available: false });
        return NextResponse.json(output, { status: 409 });
      }

      const output = new Output(true, [], [], { available: true });
      return NextResponse.json(output, { status: 200 });
    }

    const masterId = await getTeamMasterId(teamId);
    if (!masterId) {
      const output = new Output(false, [], ["Time não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const isTeamMaster = masterId === profileId;

    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            hasPermanentSubscription: true,
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

    const totalManagers = teamMembers.filter((member) => member.role === "manager").length;
    const totalOperators = teamMembers.filter((member) => member.role === "operator").length;

    const activeUsers = teamMembers
      .filter((member) => (isTeamMaster ? true : member.profileId !== profileId))
      .map((member) => ({
        id: member.profile.id,
        name: member.profile.fullName || "Usuário",
        email: member.profile.email,
        role: member.role.toLowerCase(),
        functions: member.functions,
        profileIconUrl: member.profile.profileIconUrl,
        managerId: masterId,
        leadsCount: member.profile._count?.leadsAsAssignee ?? 0,
        meetingsCount: member.profile._count?.leadsAsCloser ?? 0,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        hasPermanentSubscription: member.profile.hasPermanentSubscription,
      }));

    let pendingAsUsers: any[] = [];
    if (isTeamMaster) {
      const pendingOperators = await prisma.pendingOperator.findMany({
        where: {
          teamId,
          operatorCreated: false,
        },
        orderBy: { createdAt: "desc" },
      });

      pendingAsUsers = pendingOperators.map((pending) => ({
        id: pending.id,
        name: pending.name,
        email: pending.email,
        role: String(pending.role).toLowerCase(),
        profileIconUrl: null,
        managerId: masterId,
        leadsCount: 0,
        meetingsCount: 0,
        createdAt: pending.createdAt,
        updatedAt: pending.updatedAt,
        isPending: true,
        pendingPayment: {
          id: pending.id,
          paymentId: pending.paymentId,
          paymentStatus: pending.paymentStatus,
          paymentMethod: pending.paymentMethod,
          operatorCreated: pending.operatorCreated,
        },
      }));
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

    const { teamId, profileId, teamMember } = teamAccess.access;
    if (teamMember.role !== "manager") {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const masterId = await getTeamMasterId(teamId);
    if (!masterId) {
      const output = new Output(false, [], ["Time não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const isTeamMaster = masterId === profileId;

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

      if (!isTeamMaster) {
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

      if (!isTeamMaster) {
        const output = new Output(false, [], ["Apenas o master do time pode remover usuários"], null);
        return NextResponse.json(output, { status: 403 });
      }

      if (validatedData.profileId === masterId) {
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

    if (!isTeamMaster && validatedData.id === masterId) {
      const output = new Output(false, [], ["Você não pode editar o master do time"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (validatedData.name || validatedData.email) {
      await profileRepository.updateProfileById(validatedData.id, {
        ...(validatedData.name ? { fullName: validatedData.name } : {}),
        ...(validatedData.email ? { email: normalizeEmail(validatedData.email) } : {}),
      });
    }

    if (validatedData.role || validatedData.functions) {
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
            profileIconUrl: true,
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
      profileIconUrl: updatedMember?.profile.profileIconUrl,
      managerId: masterId,
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

    const { teamId, profileId, teamMember } = teamAccess.access;
    if (teamMember.role !== "manager") {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const masterId = await getTeamMasterId(teamId);
    if (!masterId) {
      const output = new Output(false, [], ["Time não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (masterId !== profileId) {
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

    if (userId === masterId) {
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
