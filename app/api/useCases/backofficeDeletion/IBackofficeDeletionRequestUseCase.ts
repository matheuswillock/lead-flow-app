import type { BackofficeDeletionApprovalDecision, BackofficeDeletionRequestType } from "@prisma/client"
import { Output } from "@/lib/output"

export interface IBackofficeDeletionRequestUseCase {
  createRequest(input: {
    type: BackofficeDeletionRequestType
    targetId: string
    reason?: string | null
    requestedByProfileId: string
  }): Promise<Output>

  listRequests(input?: { status?: string }): Promise<Output>

  decide(input: {
    requestId: string
    decision: BackofficeDeletionApprovalDecision
    approverProfileId: string
    approverEmail: string
  }): Promise<Output>
}
