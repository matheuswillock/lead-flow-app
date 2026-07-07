import type { ActivityType, LeadActivity } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type CreateIdempotentLeadActivityInput = {
  leadId: string
  type: ActivityType
  body: string
  sourceKey: string
  createdBy?: string | null
  payload?: Record<string, unknown>
}

export async function createIdempotentLeadActivity(
  input: CreateIdempotentLeadActivityInput
): Promise<LeadActivity | null> {
  const existing = await prisma.leadActivity.findFirst({
    where: {
      leadId: input.leadId,
      type: input.type,
      payload: {
        path: ["sourceKey"],
        equals: input.sourceKey,
      },
    },
    select: { id: true },
  })

  if (existing) {
    return null
  }

  return prisma.leadActivity.create({
    data: {
      leadId: input.leadId,
      type: input.type,
      body: input.body,
      createdBy: input.createdBy ?? null,
      payload: {
        ...input.payload,
        sourceKey: input.sourceKey,
      },
    },
  })
}
