import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get('x-supabase-user-id');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        fullName: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      const output = new Output(false, [], ["Perfil não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    // Data de hoje (início e fim do dia)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar agendamentos do manager E de seus operators
      const operatorIds = profile.operators.map((op: { id: string }) => op.id);
      whereClause = {
        lead: {
          OR: [
            { managerId: profile.id },
            { assignedTo: { in: operatorIds } }
          ],
        },
        date: {
          gte: startOfDay, // Desde o início do dia
          lte: endOfDay, // Até o fim do dia
        },
      };
    } else {
      // Operator: buscar apenas agendamentos atribuídos a ele
      whereClause = {
        lead: {
          assignedTo: profile.id,
        },
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    }

    // Buscar agendamentos com informações do lead e responsável
    const schedules = await prisma.leadsSchedule.findMany({
      where: whereClause,
      select: {
        id: true,
        leadId: true,
        date: true,
        meetingTitle: true,
        notes: true,
        meetingLink: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            name: true,
            email: true,
            phone: true,
            assignedTo: true,
            managerId: true,
            assignee: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            },
            manager: {
              select: {
                id: true,
                fullName: true,
                email: true,
              }
            }
          }
        }
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Formatar dados para o frontend
    const formattedSchedules = schedules.map(schedule => ({
      id: schedule.id,
      date: schedule.date,
      leadName: schedule.lead.name,
      leadEmail: schedule.lead.email || '',
      leadPhone: schedule.lead.phone || '',
      responsible: schedule.lead.assignee?.fullName || schedule.lead.manager?.fullName || 'Não atribuído',
      responsibleEmail: schedule.lead.assignee?.email || schedule.lead.manager?.email || '',
      meetingTitle: schedule.meetingTitle,
      notes: schedule.notes,
      meetingLink: schedule.meetingLink,
      leadId: schedule.leadId,
    }));

    const output = new Output(true, [], [], formattedSchedules);
    return NextResponse.json(output, { status: 200 });

  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
