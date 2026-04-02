import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

const scheduleSchema = z.object({
  date: z.string().datetime(),
  meetingTitle: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().url("Link da reunião inválido").optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  extraGuests: z.array(z.string().email("Email inválido")).optional(),
  transitionStatusToScheduled: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const {
      date,
      meetingTitle,
      notes,
      meetingLink,
      closerId,
      extraGuests,
      transitionStatusToScheduled,
    } = validation.data;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        assignee: {
          select: { email: true },
        },
      },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const resolvedCloserId = closerId || lead.closerId;
    if (!resolvedCloserId) {
      const output = new Output(false, [], ["Selecione um closer para a reunião."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    const result = await leadScheduleService.createSchedule({
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email ?? null,
      leadStatus: lead.status,
      leadManagerId: lead.managerId,
      leadAssignedTo: lead.assignedTo ?? null,
      leadAssigneeEmail: lead.assignee?.email ?? null,
      leadCurrentCloserId: lead.closerId ?? null,
      leadCode: lead.leadCode ?? null,
      closerId: resolvedCloserId,
      teamId: teamAccess.access.teamId,
      meetingDate: date,
      meetingTitle: meetingTitle || "",
      meetingNotes: notes,
      meetingLink,
      extraGuests,
      createdByProfileId: teamAccess.access.profileId,
      transitionStatusToScheduled,
    });

    if (!result.isValid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: existingSchedule ? 200 : 201 });
  } catch (error) {
    console.error("[LeadScheduleRoute][POST] Erro ao criar agendamento:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const schedules = await leadScheduleRepository.findByLeadId(leadId);

    const output = new Output(true, [], [], schedules);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[LeadScheduleRoute][GET] Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
