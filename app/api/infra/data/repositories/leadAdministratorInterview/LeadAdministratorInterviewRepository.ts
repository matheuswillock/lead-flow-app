import { prisma } from "@/app/api/infra/data/prisma"
import type {
  ILeadAdministratorInterviewRepository,
  LeadAdministratorInterviewRecord,
  SaveLeadAdministratorInterviewInput,
} from "./ILeadAdministratorInterviewRepository"

const SELECT = {
  leadId: true,
  scheduledAt: true,
  scheduledLocal: true,
  administratorName: true,
  notes: true,
  clientNotifiedAt: true,
  updatedAt: true,
} as const

function toRecord(row: {
  leadId: string
  scheduledAt: Date
  scheduledLocal: string
  administratorName: string | null
  notes: string | null
  clientNotifiedAt: Date | null
  updatedAt: Date
}): LeadAdministratorInterviewRecord {
  return {
    leadId: row.leadId,
    scheduledAt: row.scheduledAt.toISOString(),
    scheduledLocal: row.scheduledLocal,
    administratorName: row.administratorName,
    notes: row.notes,
    clientNotifiedAt: row.clientNotifiedAt ? row.clientNotifiedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export class LeadAdministratorInterviewRepository implements ILeadAdministratorInterviewRepository {
  async findLead(leadId: string): Promise<{ teamId: string | null; name: string } | null> {
    return prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true, name: true } })
  }

  async findByLeadId(leadId: string): Promise<LeadAdministratorInterviewRecord | null> {
    const row = await prisma.leadAdministratorInterview.findUnique({ where: { leadId }, select: SELECT })
    return row ? toRecord(row) : null
  }

  async save(input: SaveLeadAdministratorInterviewInput): Promise<LeadAdministratorInterviewRecord> {
    const current = await prisma.leadAdministratorInterview.findUnique({
      where: { leadId: input.leadId },
      select: { scheduledLocal: true },
    })
    // Nova data = cliente precisa ser avisado de novo.
    const rescheduled = !current || current.scheduledLocal !== input.scheduledLocal
    const data = {
      teamId: input.teamId,
      scheduledAt: input.scheduledAt,
      scheduledLocal: input.scheduledLocal,
      administratorName: input.administratorName,
      notes: input.notes,
      updatedByProfileId: input.updatedByProfileId,
      ...(rescheduled ? { clientNotifiedAt: null } : {}),
    }
    const row = await prisma.leadAdministratorInterview.upsert({
      where: { leadId: input.leadId },
      create: { leadId: input.leadId, ...data },
      update: data,
      select: SELECT,
    })
    return toRecord(row)
  }

  async markClientNotified(leadId: string, notifiedAt: Date): Promise<LeadAdministratorInterviewRecord> {
    const row = await prisma.leadAdministratorInterview.update({
      where: { leadId },
      data: { clientNotifiedAt: notifiedAt },
      select: SELECT,
    })
    return toRecord(row)
  }

  async deleteByLeadId(leadId: string): Promise<void> {
    await prisma.leadAdministratorInterview.deleteMany({ where: { leadId } })
  }
}

export const leadAdministratorInterviewRepository = new LeadAdministratorInterviewRepository()
