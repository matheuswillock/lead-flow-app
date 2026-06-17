import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { invalidateTeamCalendarCache } from "@/lib/cache/invalidation";

async function getCachedLeadSchedule(leadId: string) {
  "use cache";
  cacheTag(cacheTags.leadSchedules(leadId));
  cacheLife({ stale: 30, revalidate: 60 });
  return leadScheduleRepository.findByLeadId(leadId);
}

const scheduleSchema = z.object({
  date: z.string().datetime().optional(),
  meetingTitle: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().optional(),
  meetingType: z.enum(["online", "call", "whatsapp"]).optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  extraGuests: z.array(z.string().email("Email inválido")).optional(),
  transitionStatusToScheduled: z.boolean().optional(),
  confirmNoShowSchedule: z.boolean().optional(),
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
      meetingType,
      closerId,
      extraGuests,
      transitionStatusToScheduled,
      confirmNoShowSchedule,
    } = validation.data;
    const meetingLinkValidation = validateMeetingLinkValue(meetingLink, {
      required: false,
    });

    if (!meetingLinkValidation.isValid) {
      const output = new Output(false, [], [meetingLinkValidation.error], null);
      return NextResponse.json(output, { status: 400 });
    }

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

    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    const resolvedCloserId = closerId || lead.closerId;
    if (!resolvedCloserId) {
      if (lead.isTransfer !== true) {
        const output = new Output(false, [], ["Selecione um closer para a reunião."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!date) {
        const output = new Output(false, [], ["Data do pré-agendamento é obrigatória."], null);
        return NextResponse.json(output, { status: 400 });
      }

      const meetingDate = new Date(date);
      if (Number.isNaN(meetingDate.getTime())) {
        const output = new Output(false, [], ["Data do pré-agendamento inválida."], null);
        return NextResponse.json(output, { status: 400 });
      }

      const resolvedMeetingTitle = meetingTitle?.trim() || `Estudo Plano de Saúde: ${lead.name}`;
      const resolvedMeetingType =
        meetingType ??
        ((lead.meetingType === "online" || lead.meetingType === "call" || lead.meetingType === "whatsapp")
          ? lead.meetingType
          : "online");

      const [preSchedule] = await prisma.$transaction([
        prisma.leadsSchedule.upsert({
          where: { leadId },
          create: {
            leadId,
            date: meetingDate,
            meetingTitle: resolvedMeetingTitle,
            notes,
            meetingLink: null,
            meetingType: resolvedMeetingType,
            extraGuests: extraGuests ?? [],
            publicShareTokenHash: null,
            publicShareExpiresAt: null,
          },
          update: {
            date: meetingDate,
            meetingTitle: resolvedMeetingTitle,
            notes,
            meetingLink: null,
            meetingType: resolvedMeetingType,
            extraGuests: extraGuests ?? [],
            publicShareTokenHash: null,
            publicShareExpiresAt: null,
          },
        }),
        prisma.lead.update({
          where: { id: leadId },
          data: {
            meetingDate,
            meetingTitle: resolvedMeetingTitle,
            meetingNotes: notes || null,
            meetingLink: null,
            meetingType: resolvedMeetingType,
          },
        }),
      ]);

      invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId });
      const output = new Output(true, ["Pré-agendamento salvo com sucesso"], [], {
        ...preSchedule,
        status: lead.status,
      });
      return NextResponse.json(output, { status: existingSchedule ? 200 : 201 });
    }

    if (!resolvedCloserId) {
      const output = new Output(false, [], ["Selecione um closer para a reunião."], null);
      return NextResponse.json(output, { status: 400 });
    }

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
      meetingLink: meetingLinkValidation.normalized,
      meetingType:
        meetingType ??
        ((lead.meetingType === "online" || lead.meetingType === "call" || lead.meetingType === "whatsapp")
          ? lead.meetingType
          : null),
      extraGuests,
      createdByProfileId: teamAccess.access.profileId,
      transitionStatusToScheduled,
      confirmNoShowSchedule,
    });

    if (!result.isValid) {
      return NextResponse.json(result, { status: 400 });
    }

    invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId, leadId });
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

    const schedules = await getCachedLeadSchedule(leadId);

    const output = new Output(true, [], [], schedules);
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[LeadScheduleRoute][GET] Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
