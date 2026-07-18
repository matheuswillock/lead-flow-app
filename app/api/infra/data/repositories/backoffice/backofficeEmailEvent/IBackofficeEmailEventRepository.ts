import type { BackofficeEmailEventType, Prisma } from "@prisma/client"

export interface AppendBackofficeEmailEventInput {
  logId: string
  type: BackofficeEmailEventType
  occurredAt: Date
  metadata?: Prisma.InputJsonValue | null
}

export interface IBackofficeEmailEventRepository {
  append(data: AppendBackofficeEmailEventInput): Promise<boolean>
}
