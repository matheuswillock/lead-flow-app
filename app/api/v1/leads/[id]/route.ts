import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../useCases/profiles/ProfileUseCase";
import { UpdateLeadRequestSchema } from "../DTO/requestToUpdateLead";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get('x-supabase-user-id');
    const teamId = request.headers.get('x-team-id') || new URL(request.url).searchParams.get('teamId');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }
    if (!teamId) {
      const output = new Output(false, [], ["Team ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true }
    });

    if (!profile) {
      const output = new Output(false, [], ["Perfil não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id
        }
      }
    });

    if (!membership) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }
    if (
      membership.role === "operator" &&
      !membership.functions?.includes("SDR") &&
      !membership.functions?.includes("CLOSER")
    ) {
      const output = new Output(false, [], ["Acesso negado: funcao SDR ou Closer necessaria para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, teamId: true }
    });

    if (!lead || lead.teamId !== teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const output = await leadUseCase.getLeadById(supabaseId, id);
    const status = output.isValid ? 200 : (output.errorMessages.includes("Lead não encontrado") ? 404 : 400);
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao buscar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extrair supabaseId dos headers
    const supabaseId = request.headers.get('x-supabase-user-id');
    const teamId = request.headers.get('x-team-id') || new URL(request.url).searchParams.get('teamId');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }
    if (!teamId) {
      const output = new Output(false, [], ["Team ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    
    let validatedData;
    try {
      validatedData = UpdateLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true }
    });

    if (!profile) {
      const output = new Output(false, [], ["Perfil não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id
        }
      }
    });

    if (!membership) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }
    if (
      membership.role === "operator" &&
      !membership.functions?.includes("SDR") &&
      !membership.functions?.includes("CLOSER")
    ) {
      const output = new Output(false, [], ["Acesso negado: funcao SDR ou Closer necessaria para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const wantsMeetingHealdUpdate = Object.prototype.hasOwnProperty.call(body, "meetingHeald");

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, teamId: true, status: true, closerId: true }
    });

    if (!lead || lead.teamId !== teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (wantsMeetingHealdUpdate) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { masterId: true },
      });

      const isTeamMaster = !!(team && team.masterId === profile.id);
      const isAssignedCloser = !!lead.closerId && lead.closerId === profile.id;
      const canMarkMeetingHeald =
        isTeamMaster || (membership.functions?.includes("CLOSER") && isAssignedCloser);

      if (lead.status !== "scheduled") {
        const output = new Output(false, [], ["Reuniao so pode ser marcada como realizada para leads agendados."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!canMarkMeetingHeald) {
        const output = new Output(false, [], ["Acesso negado: somente o closer do lead (ou master) pode marcar reuniao como realizada."], null);
        return NextResponse.json(output, { status: 403 });
      }
    }

    const output = await leadUseCase.updateLead(supabaseId, id, validatedData);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extrair supabaseId dos headers
    const supabaseId = request.headers.get('x-supabase-user-id');
    const teamId = request.headers.get('x-team-id') || new URL(request.url).searchParams.get('teamId');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }
    if (!teamId) {
      const output = new Output(false, [], ["Team ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true }
    });

    if (!profile) {
      const output = new Output(false, [], ["Perfil não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id
        }
      }
    });

    if (!membership) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }
    if (
      membership.role === "operator" &&
      !membership.functions?.includes("SDR") &&
      !membership.functions?.includes("CLOSER")
    ) {
      const output = new Output(false, [], ["Acesso negado: funcao SDR ou Closer necessaria para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, teamId: true }
    });

    if (!lead || lead.teamId !== teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const output = await leadUseCase.deleteLead(supabaseId, id);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao excluir lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
