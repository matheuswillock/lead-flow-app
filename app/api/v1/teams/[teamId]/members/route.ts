import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { NotificationType } from "@prisma/client";
import { notificationService } from "@/app/api/services/notifications/NotificationService";

const addMemberSchema = z.object({
  profileId: z.string().uuid(),
});

const removeMemberSchema = z.object({
  profileId: z.string().uuid(),
});

const listMembersFunctionSchema = z.enum(["SDR", "CLOSER"]);

async function getRequesterProfile(supabaseId: string) {
  return prisma.profile.findUnique({
    where: { supabaseId },
    select: { id: true, email: true, fullName: true, isMaster: true },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const logContext: {
    teamId: string | null;
    requesterProfileId: string | null;
    requestedFunction: z.infer<typeof listMembersFunctionSchema> | null;
    totalMembers: number;
    filteredMembers: number;
  } = {
    teamId: null,
    requesterProfileId: null,
    requestedFunction: null,
    totalMembers: 0,
    filteredMembers: 0,
  };

  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    logContext.teamId = teamId;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const requestedFunctionParam = new URL(request.url).searchParams.get("function");
    let requestedFunction: z.infer<typeof listMembersFunctionSchema> | null = null;
    if (requestedFunctionParam) {
      const parsedFunction = listMembersFunctionSchema.safeParse(requestedFunctionParam.toUpperCase());
      if (!parsedFunction.success) {
        return NextResponse.json(
          new Output(false, [], ["Parâmetro function inválido. Use SDR ou CLOSER."], null),
          { status: 400 }
        );
      }
      requestedFunction = parsedFunction.data;
    }
    logContext.requestedFunction = requestedFunction;

    const profile = await getRequesterProfile(supabaseId);
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }
    logContext.requesterProfileId = profile.id;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        new Output(false, [], ["Você não faz parte deste time"], null),
        { status: 403 }
      );
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            supabaseId: true,
            googleCalendarConnected: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedMembers = members.map((member) => ({
      id: member.id,
      profileId: member.profileId,
      name: member.profile.fullName || member.profile.email || "Usuário",
      email: member.profile.email,
      role: member.role,
      functions: member.functions,
      googleCalendarConnected: member.profile.googleCalendarConnected ?? false,
      profileIconUrl: member.profile.profileIconUrl,
      isMaster: member.profileId === team.masterId,
    }));

    const filteredMembers = requestedFunction
      ? formattedMembers.filter((member) => member.functions?.includes(requestedFunction))
      : formattedMembers;
    logContext.totalMembers = formattedMembers.length;
    logContext.filteredMembers = filteredMembers.length;

    let eligibleProfiles: Array<{ id: string; name: string; email: string | null }> = [];
    let transferCandidates: Array<{ id: string; name: string; email: string | null }> = [];

    if (!requestedFunction) {
      const masterTeamMembers = await prisma.teamMember.findMany({
        where: {
          team: { masterId: team.masterId },
        },
        distinct: ["profileId"],
        include: {
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              supabaseId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const masterAccountProfiles = await prisma.profile.findMany({
        where: {
          OR: [{ id: team.masterId }, { managerId: team.masterId }],
          supabaseId: { not: null },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          supabaseId: true,
        },
      });

      const currentMemberIds = new Set(members.map((member) => member.profileId));
      eligibleProfiles = masterAccountProfiles
        .filter((accountProfile) => accountProfile.supabaseId)
        .filter((accountProfile) => !currentMemberIds.has(accountProfile.id))
        .map((accountProfile) => ({
          id: accountProfile.id,
          name: accountProfile.fullName || accountProfile.email || "Usuário",
          email: accountProfile.email,
        }))
        .sort((a, b) => {
          const aKey = (a.name || a.email || "").toLowerCase();
          const bKey = (b.name || b.email || "").toLowerCase();
          return aKey.localeCompare(bKey, "pt-BR");
        });

      transferCandidates = masterTeamMembers
        .filter((member) => member.profile?.supabaseId)
        .filter((member) => member.profileId !== team.masterId)
        .map((member) => ({
          id: member.profile.id,
          name: member.profile.fullName || member.profile.email || "Usuário",
          email: member.profile.email,
        }));
    }

    return NextResponse.json(
      new Output(true, [], [], {
        team: { id: team.id, name: team.name, masterId: team.masterId },
        members: filteredMembers,
        eligibleProfiles,
        transferCandidates,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[TeamMembersRoute][GET] Erro ao listar membros do time", {
      ...logContext,
      error,
    });
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar membros do time"], null),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json();
    let payload: z.infer<typeof addMemberSchema>;
    try {
      payload = addMemberSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const profile = await getRequesterProfile(supabaseId);
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    if (team.masterId !== profile.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master do time pode adicionar membros"], null),
        { status: 403 }
      );
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: payload.profileId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        new Output(false, [], ["Usuário já pertence ao time"], null),
        { status: 409 }
      );
    }

    const eligibleProfile = await prisma.profile.findFirst({
      where: {
        id: payload.profileId,
        OR: [{ id: team.masterId }, { managerId: team.masterId }],
      },
      select: {
        role: true,
        functions: true,
        supabaseId: true,
        fullName: true,
        email: true,
      },
    });

    if (!eligibleProfile) {
      return NextResponse.json(
        new Output(false, [], ["Usuário não pertence à conta deste master"], null),
        { status: 400 }
      );
    }

    if (!eligibleProfile.supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Usuário precisa ter conta ativa no sistema"], null),
        { status: 400 }
      );
    }

    const newMember = await prisma.teamMember.create({
      data: {
        teamId,
        profileId: payload.profileId,
        role: eligibleProfile.role,
        functions: eligibleProfile.functions ?? [],
      },
    });

    try {
      await notificationService.createTeamMembershipNotification({
        teamId,
        actorProfileId: profile.id,
        actorName: profile.fullName || profile.email || "Usuário",
        teamName: team.name,
        recipientProfileId: payload.profileId,
        type: NotificationType.TEAM_MEMBER_ADDED,
      });
    } catch (notificationError) {
      console.error("[TeamMembersRoute][POST] Erro ao criar notificação de membro adicionado:", notificationError);
    }

    return NextResponse.json(
      new Output(true, ["Membro adicionado com sucesso"], [], newMember),
      { status: 200 }
    );
  } catch (error) {
    console.error("[TeamMembersRoute][POST] Erro ao adicionar membro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao adicionar membro"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json();
    let payload: z.infer<typeof removeMemberSchema>;
    try {
      payload = removeMemberSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const profile = await getRequesterProfile(supabaseId);
    if (!profile) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });

    if (!team) {
      return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
    }

    if (team.masterId !== profile.id) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master do time pode remover membros"], null),
        { status: 403 }
      );
    }

    if (payload.profileId === team.masterId) {
      return NextResponse.json(
        new Output(false, [], ["Não é possível remover o master do time"], null),
        { status: 400 }
      );
    }

    try {
      await notificationService.createTeamMembershipNotification({
        teamId,
        actorProfileId: profile.id,
        actorName: profile.fullName || profile.email || "Usuário",
        teamName: team.name,
        recipientProfileId: payload.profileId,
        type: NotificationType.TEAM_MEMBER_REMOVED,
      });
    } catch (notificationError) {
      console.error("[TeamMembersRoute][DELETE] Erro ao criar notificação de membro removido:", notificationError);
    }

    await prisma.teamMember.delete({
      where: {
        teamId_profileId: {
          teamId,
          profileId: payload.profileId,
        },
      },
    });

    return NextResponse.json(
      new Output(true, ["Membro removido com sucesso"], [], null),
      { status: 200 }
    );
  } catch (error) {
    console.error("[TeamMembersRoute][DELETE] Erro ao remover membro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover membro"], null),
      { status: 500 }
    );
  }
}
