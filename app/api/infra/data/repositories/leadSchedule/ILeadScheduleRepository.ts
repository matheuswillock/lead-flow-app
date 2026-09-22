import { InviteDispatchStatus, LeadsSchedule, MeetingHeald, Prisma } from "@prisma/client";
import type { TeamScopeVisibility } from "@/lib/teams/teamScopeVisibility";

export interface CreateLeadScheduleDTO {
  id?: string;
  leadId: string;
  date: Date;
  meetingTitle?: string;
  notes?: string;
  meetingLink?: string | null;
  /**
   * SPEC 13 (Agenda na Criação de Lead), A-E2 — o DTO original não tinha esse
   * campo, mas `LeadScheduleService.createSchedule` grava `meetingType` no
   * schedule desde sempre (via `tx.leadsSchedule.upsert` direto). Adicionado
   * aqui para `upsertByLeadIdWithTx` poder cobrir o campo sem duplicar a
   * lógica de gravação.
   */
  meetingType?: string | null;
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
  /**
   * SPEC 13, A-E2 — mesmo motivo do `meetingType`: `createSchedule` reseta
   * este campo para `null` quando a data da reunião muda (ou mantém o valor
   * existente quando não muda). O chamador computa o valor final; o
   * repositório só grava.
   */
  reminder30MinSentAt?: Date | null;
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
   * SPEC 13 (Agenda na Criação de Lead), A-E2 — mesma lógica de
   * `upsertByLeadId`, mas dentro de uma transação recebida (`tx`), para
   * `IMeetingRepository.upsertMeetingWithLeadTransition` poder gravar a
   * reunião e a transição de status do lead atomicamente. `upsertByLeadId`
   * (sem `tx`) continua existindo e inalterado para não quebrar quem já o usa
   * fora de transação.
   */
  upsertByLeadIdWithTx(
    tx: Prisma.TransactionClient,
    leadId: string,
    data: CreateLeadScheduleDTO
  ): Promise<LeadsSchedule>;

  /**
   * Deleta um agendamento
   */
  delete(id: string): Promise<void>;

  /**
   * Agendamentos do dia para o widget de agenda do dashboard.
   *
   * A restricao de papel vem particionada POR TIME em `visibility`: nos times
   * onde o perfil e manager-like entra a agenda inteira; nos demais, so os leads
   * que ele atende ou criou. Um perfil multi-time pode cair nos dois casos na
   * mesma consulta.
   */
  findDayAgendaByTeamScope(input: {
    visibility: TeamScopeVisibility;
    dayStart: Date;
    dayEnd: Date;
  }): Promise<DayAgendaScheduleRow[]>;
}

export type DayAgendaProfileRef = {
  id: string;
  fullName: string | null;
  email: string;
};

export type DayAgendaScheduleRow = {
  id: string;
  leadId: string;
  date: Date;
  meetingTitle: string | null;
  notes: string | null;
  meetingLink: string | null;
  createdAt: Date;
  updatedAt: Date;
  lead: {
    name: string;
    email: string | null;
    phone: string | null;
    meetingHeald: MeetingHeald | null;
    meetingPresenceConfirmed: boolean;
    assignedTo: string | null;
    assignee: DayAgendaProfileRef | null;
    manager: DayAgendaProfileRef | null;
    closer: DayAgendaProfileRef | null;
    team: { id: string; name: string } | null;
  };
};
