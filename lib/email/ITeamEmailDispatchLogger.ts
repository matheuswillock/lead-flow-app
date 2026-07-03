import type { EmailLogCategory } from "@prisma/client"

export interface CreateTeamEmailLogInput {
  teamId: string
  recipientEmail: string
  recipientName?: string | null
  subject: string
  category: EmailLogCategory
  sourceType?: string | null
  sourceId?: string | null
  campaignId?: string | null
  dispatchId?: string | null
}

export interface ITeamEmailDispatchLogger {
  createQueuedTeamEmailLog(input: CreateTeamEmailLogInput): Promise<string>
  createManyQueuedTeamEmailLogs(inputs: CreateTeamEmailLogInput[]): Promise<string[]>
  createQueuedTeamEmailLogs(inputs: CreateTeamEmailLogInput[]): Promise<{ email: string; logId: string }[]>
  markTeamEmailLogSent(logId: string, resendEmailId: string): Promise<void>
  markManyTeamEmailLogsSent(entries: Array<{ logId: string; resendEmailId: string }>): Promise<void>
  markTeamEmailLogFailed(logId: string, errorMessage: string): Promise<void>
}
