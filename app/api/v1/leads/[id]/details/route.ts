import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { isGoogleConnectionActive } from "@/lib/google/connection";

async function getCachedLeadAttachments(leadId: string) {
  "use cache";
  cacheTag(cacheTags.leadDetails(leadId));
  cacheLife({ stale: 30, revalidate: 60 });
  return leadAttachmentUseCase.listAttachments(leadId);
}

async function getCachedLeadTeamMembers(teamId: string) {
  "use cache";
  cacheTag(cacheTags.teamMembers(teamId));
  cacheLife({ stale: 30, revalidate: 60 });
  return Promise.all([
    prisma.teamMember.findMany({
      where: { teamId },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            supabaseId: true,
            googleConnection: {
              select: { refreshToken: true, revokedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { masterId: true, name: true },
    }),
  ]);
}

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

/**
 * GET /api/v1/leads/[id]/details
 *
 * Endpoint agregado: autentica uma única vez e busca em paralelo lead,
 * anexos e membros do time. Reduz de 3 round-trips independentes para 1.
 *
 * Response: { lead: LeadResponseDTO, attachments: Attachment[], teamMembers: MemberDTO[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    const teamId =
      request.headers.get("x-team-id") ||
      new URL(request.url).searchParams.get("teamId");

    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["ID do usuário é obrigatório"], null),
        { status: 401 }
      );
    }
    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["Team ID é obrigatório"], null),
        { status: 400 }
      );
    }

    const { id: leadId } = await params;

    // Auth — uma única resolução de profile + membership
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Perfil não encontrado"], null),
        { status: 404 }
      );
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId: profile.id } },
    });

    if (!membership) {
      return NextResponse.json(
        new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null),
        { status: 404 }
      );
    }
    if (
      membership.role === "operator" &&
      !membership.functions?.includes("SDR") &&
      !membership.functions?.includes("CLOSER")
    ) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado: funcao SDR ou Closer necessaria."], null),
        { status: 403 }
      );
    }

    // Verificar que o lead pertence ao time antes de disparar o Promise.all
    const leadCheck = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!leadCheck || leadCheck.teamId !== teamId) {
      return NextResponse.json(
        new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null),
        { status: 404 }
      );
    }

    // Busca paralela: lead, anexos, membros do time + info do time
    const [leadSettled, attachmentsSettled, membersAndTeamSettled] =
      await Promise.allSettled([
        leadUseCase.getLeadById(supabaseId, leadId),
        getCachedLeadAttachments(leadId),
        getCachedLeadTeamMembers(teamId),
      ]);

    // Mapear lead
    if (
      leadSettled.status === "rejected" ||
      !leadSettled.value.isValid
    ) {
      const errorMessages =
        leadSettled.status === "fulfilled"
          ? leadSettled.value.errorMessages
          : ["Erro ao carregar lead"];
      const status = errorMessages.includes("Lead não encontrado") ? 404 : 400;
      return NextResponse.json(
        new Output(false, [], errorMessages, null),
        { status }
      );
    }

    const lead = leadSettled.value.result;

    // Mapear anexos (graceful degradation se falhar)
    const attachments =
      attachmentsSettled.status === "fulfilled" &&
      attachmentsSettled.value.isValid
        ? (attachmentsSettled.value.result as unknown[]) ?? []
        : [];

    if (attachmentsSettled.status === "rejected") {
      console.error(
        "[LeadDetailsRoute][GET] Erro ao buscar anexos (graceful degradation):",
        attachmentsSettled.reason
      );
    }

    // Mapear membros do time (graceful degradation se falhar)
    let teamMembers: unknown[] = [];
    if (membersAndTeamSettled.status === "fulfilled") {
      const [rawMembers, team] = membersAndTeamSettled.value;
      teamMembers = rawMembers.map((member) => ({
        id: member.id,
        profileId: member.profileId,
        name: member.profile.fullName || member.profile.email || "Usuário",
        email: member.profile.email,
        role: member.role,
        functions: member.functions,
        googleCalendarConnected: isGoogleConnectionActive(
          member.profile.googleConnection
        ),
        profileIconUrl: member.profile.profileIconUrl,
        isMaster: team ? member.profileId === team.masterId : false,
      }));
    } else {
      console.error(
        "[LeadDetailsRoute][GET] Erro ao buscar membros do time (graceful degradation):",
        membersAndTeamSettled.reason
      );
    }

    return NextResponse.json(
      new Output(true, [], [], { lead, attachments, teamMembers }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[LeadDetailsRoute][GET] Erro ao buscar detalhes do lead:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
