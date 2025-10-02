import { prisma } from "../../prisma";
import type { 
  ILeadScheduleRepository, 
  CreateLeadScheduleDTO,
  UpdateLeadScheduleDTO
} from "./ILeadScheduleRepository";
import { LeadsSchedule } from "@prisma/client";

export class LeadScheduleRepository implements ILeadScheduleRepository {
  
  /**
   * Cria um registro de agendamento
   */
  async create(data: CreateLeadScheduleDTO): Promise<LeadsSchedule> {
    return await prisma.leadsSchedule.create({
      data: {
        leadId: data.leadId,
        date: data.date,
        notes: data.notes,
      },
    });
  }

  /**
   * Busca registros de agendamentos por leadId
   */
  async findByLeadId(leadId: string): Promise<LeadsSchedule[]> {
    return await prisma.leadsSchedule.findMany({
      where: {
        leadId,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Busca o último registro de agendamento de um lead
   */
  async findLatestByLeadId(leadId: string): Promise<LeadsSchedule | null> {
    return await prisma.leadsSchedule.findFirst({
      where: {
        leadId,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Atualiza um agendamento existente
   */
  async update(id: string, data: UpdateLeadScheduleDTO): Promise<LeadsSchedule> {
    return await prisma.leadsSchedule.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta um agendamento
   */
  async delete(id: string): Promise<void> {
    await prisma.leadsSchedule.delete({
      where: { id },
    });
  }
}

// Instância única para uso em toda aplicação
export const leadScheduleRepository = new LeadScheduleRepository();
