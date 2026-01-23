import { NextRequest, NextResponse } from "next/server";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { z } from "zod";

const scheduleSchema = z.object({
  date: z.string().datetime(),
  notes: z.string().optional(),
  meetingLink: z.string().url("Link da reunião inválido").optional(),
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

    const { date, notes, meetingLink } = validation.data;
    const meetingDate = new Date(date);

    // Verificar se já existe um agendamento para este lead
    const existingSchedule = await leadScheduleRepository.findLatestByLeadId(leadId);

    let schedule;
    let message: string;

    if (existingSchedule) {
      // Atualizar o agendamento existente
      schedule = await leadScheduleRepository.update(existingSchedule.id, {
        date: meetingDate,
        notes,
        meetingLink,
      });
      message = "Agendamento atualizado com sucesso";
    } else {
      // Criar novo agendamento
      schedule = await leadScheduleRepository.create({
        leadId,
        date: meetingDate,
        notes,
        meetingLink,
      });
      message = "Agendamento criado com sucesso";
    }

    // Atualizar o campo meetingDate do lead
    await prisma.lead.update({
      where: { id: leadId },
      data: { meetingDate, meetingNotes: notes || null, meetingLink: meetingLink || null },
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
