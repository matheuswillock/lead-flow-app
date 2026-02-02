import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    // Data de hoje (início e fim do dia)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Construir where clause baseado na role
    let whereClause: any;

    if (teamAccess.access.teamMember.role === 'manager') {
      // Manager: buscar agendamentos do time
      whereClause = {
        lead: {
          teamId: teamAccess.access.teamId,
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
          teamId: teamAccess.access.teamId,
          OR: [
            { assignedTo: teamAccess.access.profileId },
            { createdBy: teamAccess.access.profileId },
          ],
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
