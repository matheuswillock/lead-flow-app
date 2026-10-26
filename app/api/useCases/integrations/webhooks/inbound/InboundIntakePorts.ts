import type { LeadStatus, Prisma } from "@prisma/client";
import type { InboundV2Payload } from "@/lib/webhooks/inbound/v2/payload";

/**
 * Portas do processamento de um evento do webhook v2 (SPEC 11). Cada uma é a menor superfície que o
 * caso de uso precisa de um colaborador; os adaptadores reais ficam em `InboundIntakeAdapters.ts`.
 * Isso mantém as regras do guia (duplicata, mescla, rodízio, conflito, escopo) testáveis sem banco.
 */

export type InboundWebhookConfig = {
  id: string;
  teamId: string;
  status: "active" | "paused" | "disabled";
  contractVersion: number;
  scopes: string[];
  defaultMeetingLink: string | null;
};

export interface IInboundWebhookConfigPort {
  getWebhook(webhookId: string): Promise<InboundWebhookConfig | null>;
}

export type InboundTeamContext = {
  teamId: string;
  managerProfileId: string;
  managerSupabaseId: string;
};

export interface IInboundTeamPort {
  getTeam(teamId: string): Promise<InboundTeamContext | null>;
  /** A conta do time permite escrita (não está pausada, suspensa nem em somente leitura). */
  isAccountAllowed(team: InboundTeamContext): Promise<boolean>;
}

export type ExistingContactLead = {
  id: string;
  leadCode: string | null;
  name: string;
  status: LeadStatus | null;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: Date;
};

export interface IInboundContactPort {
  /** Lead mais recente do time com o mesmo telefone, e-mail ou CNPJ; `null` se o contato é novo. */
  findExistingContact(
    teamId: string,
    contact: { phone: string; email?: string; cnpj?: string },
  ): Promise<ExistingContactLead | null>;
}

export interface IInboundAssigneePort {
  /** Rodízio atômico do webhook (DA11). */
  claimNextAssignee(webhookId: string): Promise<{ assigneeProfileId: string | null; listConfigured: boolean }>;
  /** `assigned_to` do payload: só vale se for SDR ativo do time. */
  isValidSdr(teamId: string, profileId: string): Promise<boolean>;
}

export type CreatedInboundLead = { id: string; leadCode: string | null; name: string; email: string | null };

export interface IInboundLeadWriterPort {
  create(input: {
    team: InboundTeamContext;
    payload: InboundV2Payload;
    assignedTo: string | null;
    eventId: string;
    ignoredFields: string[];
  }): Promise<{ ok: true; lead: CreatedInboundLead } | { ok: false; reason: "duplicate_conflict" | "failed"; message: string }>;

  /**
   * Mescla (DA6/D40): campo vazio recebe o valor novo, preenchido não é sobrescrito, notas são
   * acrescentadas, o SDR não muda. Devolve o que mudou.
   */
  merge(input: {
    team: InboundTeamContext;
    existing: ExistingContactLead;
    payload: InboundV2Payload;
    eventId: string;
  }): Promise<{ changedFields: string[] }>;
}

export type InboundScheduleRequest = {
  team: InboundTeamContext;
  lead: { id: string; leadCode: string | null; name: string; email: string | null; status: LeadStatus | null; assignedTo: string | null };
  closerProfileId: string;
  startsAt: Date;
  type: "online" | "call" | "whatsapp";
  title?: string;
  notes?: string;
  guests: string[];
  meetingLink?: string;
};

export type InboundScheduleResult =
  | { ok: true }
  | { ok: false; reason: "slot_unavailable" | "failed"; message: string };

export interface IInboundSchedulePort {
  isEligibleCloser(teamId: string, closerProfileId: string): Promise<boolean>;
  closerHasActiveGoogle(closerProfileId: string): Promise<boolean>;
  /** Mantém só os e-mails que são de membros do time (DA: convidados só membros). */
  filterTeamMemberEmails(teamId: string, emails: string[]): Promise<string[]>;
  createSchedule(request: InboundScheduleRequest): Promise<InboundScheduleResult>;
  /** Reunião que ocupa o mesmo horário do closer (qualquer time), para o alerta. */
  findConflictingLeadId(teamId: string, closerProfileId: string, startsAt: Date): Promise<string | null>;
  /** Até 5 próximos horários livres do closer a partir do horário pedido. */
  suggestSlots(input: { teamId: string; closerProfileId: string; from: Date }): Promise<Prisma.InputJsonValue>;
}

export interface IInboundAlertPort {
  flag(input: {
    team: InboundTeamContext;
    lead: { id: string; leadCode: string | null; name: string; assignedTo: string | null };
    reasonCode: string;
    requestedStartsAt: Date;
    /** `null` quando o closer do payload não foi confirmado como closer do time. */
    requestedCloserId: string | null;
    conflictingLeadId: string | null;
    suggestedSlots: Prisma.InputJsonValue;
    sourceEventId: string;
  }): Promise<void>;
}

export interface IInboundEventLogPort {
  record(input: {
    teamId: string;
    webhookId: string;
    result: "success" | "failure" | "rejected";
    requestPayload: Prisma.JsonValue;
    responsePayload: Prisma.InputJsonValue;
    errorMessage: string | null;
  }): Promise<void>;
  touchUsage(webhookId: string, success: boolean): Promise<void>;
}
