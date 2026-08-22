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
  publicShareTokenHash?: string | null;
  publicShareExpiresAt?: Date | null;
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
  publicShareTokenHash?: string | null;
  publicShareExpiresAt?: Date | null;
}

export interface UpsertTransferPreScheduleDTO {
  leadId: string;
  date: Date;
  meetingTitle: string;
  notes: string | null;
  meetingType: string;
}

export interface ILeadScheduleRepository {
  /**
   * Cria um registro de agendamento
   */
  create(data: CreateLeadScheduleDTO): Promise<LeadsSchedule>;

  /**
   * Cria ou atualiza o pre-agendamento herdado numa transferencia de time.
   * Sempre zera link e compartilhamento publico, que nao sobrevivem a troca de time.
   */
  upsertTransferPreSchedule(data: UpsertTransferPreScheduleDTO): Promise<void>;

  /**
   * Busca registros de agendamentos por leadId
   */
  findByLeadId(leadId: string): Promise<LeadsSchedule[]>;

  /**
   * Busca o último registro de agendamento de um lead
   */
  findLatestByLeadId(leadId: string): Promise<LeadsSchedule | null>;

  /**
   * Busca o registro único de agendamento de um lead
   */
  findUniqueByLeadId(leadId: string): Promise<LeadsSchedule | null>;

  /**
   * Atualiza um agendamento existente
   */
  update(id: string, data: UpdateLeadScheduleDTO): Promise<LeadsSchedule>;

  /**
   * Atualiza ou cria um agendamento usando leadId como chave única
   */
  upsertByLeadId(leadId: string, data: CreateLeadScheduleDTO): Promise<LeadsSchedule>;

  /**
   * Deleta um agendamento
   */
  delete(id: string): Promise<void>;
}
