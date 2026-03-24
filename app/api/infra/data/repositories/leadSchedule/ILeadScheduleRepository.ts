import { InviteDispatchStatus, LeadsSchedule, Prisma } from "@prisma/client";

export interface CreateLeadScheduleDTO {
  id?: string;
  leadId: string;
  date: Date;
  meetingTitle?: string;
  notes?: string;
  meetingLink?: string;
  extraGuests?: string[];
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  inviteDispatchStatus?: InviteDispatchStatus | null;
  inviteDispatchFallbackUsed?: boolean;
  inviteDispatchLastAttemptAt?: Date | null;
  inviteDispatchLastError?: string | null;
  inviteDispatchLastPayload?: Prisma.InputJsonValue | null;
}

export interface UpdateLeadScheduleDTO {
  date?: Date;
  meetingTitle?: string;
  notes?: string;
  meetingLink?: string;
  extraGuests?: string[];
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  inviteDispatchStatus?: InviteDispatchStatus | null;
  inviteDispatchFallbackUsed?: boolean;
  inviteDispatchLastAttemptAt?: Date | null;
  inviteDispatchLastError?: string | null;
  inviteDispatchLastPayload?: Prisma.InputJsonValue | null;
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

  /**
   * Atualiza um agendamento existente
   */
  update(id: string, data: UpdateLeadScheduleDTO): Promise<LeadsSchedule>;

  /**
   * Deleta um agendamento
   */
  delete(id: string): Promise<void>;
}
