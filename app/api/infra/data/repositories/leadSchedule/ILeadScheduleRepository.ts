import { LeadsSchedule } from "@prisma/client";

export interface CreateLeadScheduleDTO {
  leadId: string;
  date: Date;
  notes?: string;
}

export interface ILeadScheduleRepository {
  /**
   * Cria um registro de agendamento
   */
  create(data: CreateLeadScheduleDTO): Promise<LeadsSchedule>;

  /**
   * Busca registros de agendamentos por leadId
   */
  findByLeadId(leadId: string): Promise<LeadsSchedule[]>;

  /**
   * Busca o último registro de agendamento de um lead
   */
  findLatestByLeadId(leadId: string): Promise<LeadsSchedule | null>;
}
