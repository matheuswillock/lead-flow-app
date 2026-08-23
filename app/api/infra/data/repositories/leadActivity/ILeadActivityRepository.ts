import type { ActivityType, LeadActivity, Prisma } from "@prisma/client";

export interface CreateLeadActivityDTO {
  leadId: string;
  type: ActivityType;
  body: string;
  payload?: Prisma.InputJsonValue | null;
  /** `null` marca atividade emitida pelo proprio Studio, sem autor humano. */
  createdBy?: string | null;
}

export interface ILeadActivityRepository {
  create(data: CreateLeadActivityDTO): Promise<LeadActivity>;
}
