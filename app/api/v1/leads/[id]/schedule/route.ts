import { NextRequest, NextResponse } from "next/server";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { z } from "zod";
import { upsertCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";

const scheduleSchema = z.object({
  date: z.string().datetime(),
  notes: z.string().optional(),
  meetingLink: z.string().url("Link da reunião inválido").optional(),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extrair supabaseId dos headers
    const supabaseId = request.headers.get('x-supabase-user-id');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);

    if (!validation.success) {
      const output = new Output(
        false, 
        [], 
        validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { id: leadId } = await params;

    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { date, notes, meetingLink, closerId } = validation.data;
    const meetingDate = new Date(date);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        manager: true,
        closer: true,
      },
    });

    if (!lead) {
      const output = new Output(false, [], ["Lead não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    if (!lead.manager.googleCalendarConnected || !lead.manager.googleRefreshToken) {
      const output = new Output(false, [], ["Conecte seu Google Calendar para agendar reuniões"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Verificar se já existe um agendamento para este lead
    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);

    const closerProfile = closerId
      ? await prisma.profile.findUnique({
          where: { id: closerId },
          select: { email: true },
        })
      : lead.closer;

    const closerEmail = closerProfile?.email || null;

    const calendarResult = await upsertCalendarEvent({
      organizer: lead.manager,
      lead,
      closerEmail,
      meetingDate,
      notes,
      meetingLink,
      existingEventId: existingSchedule?.googleEventId ?? null,
    });

    const resolvedMeetingLink = meetingLink || calendarResult.meetLink || null;

    let schedule;
    let message: string;

    if (existingSchedule) {
      // Atualizar o agendamento existente
      schedule = await leadScheduleRepository.update(existingSchedule.id, {
        date: meetingDate,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        googleEventId: calendarResult.eventId,
        googleCalendarId: calendarResult.calendarId,
      });
      message = "Agendamento atualizado com sucesso";
    } else {
      // Criar novo agendamento
      schedule = await leadScheduleRepository.create({
        leadId,
        date: meetingDate,
        notes,
        meetingLink: resolvedMeetingLink || undefined,
        googleEventId: calendarResult.eventId,
        googleCalendarId: calendarResult.calendarId,
      });
      message = "Agendamento criado com sucesso";
    }

    // Atualizar o campo meetingDate do lead
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        meetingDate,
        meetingNotes: notes || null,
        meetingLink: resolvedMeetingLink || null,
        ...(closerId ? { closerId } : {}),
      },
    });

    const output = new Output(
      true, 
      [message], 
      [], 
      schedule
    );
    return NextResponse.json(output, { status: existingSchedule ? 200 : 201 });

  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get('x-supabase-user-id');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const { id: leadId } = await params;

    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    // Buscar agendamentos do lead
    const schedules = await leadScheduleRepository.findByLeadId(leadId);

    const output = new Output(true, [], [], schedules);
    return NextResponse.json(output, { status: 200 });

  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
