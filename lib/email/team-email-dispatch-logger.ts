import { randomUUID } from "crypto"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import type { CreateTeamEmailLogInput, ITeamEmailDispatchLogger } from "./ITeamEmailDispatchLogger"

export class TeamEmailDispatchLogger implements ITeamEmailDispatchLogger {
  async createQueuedTeamEmailLog(input: CreateTeamEmailLogInput): Promise<string> {
    const id = randomUUID()
    await emailLogRepository.createQueuedLog({
      id,
      teamId: input.teamId,
      campaignId: input.campaignId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: input.subject,
      category: input.category,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })
    return id
  }

  async markTeamEmailLogSent(logId: string, resendEmailId: string): Promise<void> {
    await emailLogRepository.markSent(logId, resendEmailId, new Date())
  }

  async markTeamEmailLogFailed(logId: string, errorMessage: string): Promise<void> {
    await emailLogRepository.markFailed(logId, randomUUID(), errorMessage, new Date())
  }
}

export const teamEmailDispatchLogger = new TeamEmailDispatchLogger()
