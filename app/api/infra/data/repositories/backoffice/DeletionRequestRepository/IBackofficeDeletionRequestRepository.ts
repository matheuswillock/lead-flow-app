import type {
  BackofficeDeletionApprovalDecision,
  BackofficeDeletionRequestStatus,
  BackofficeDeletionRequestType,
} from "@prisma/client"

export type BackofficeDeletionRequestListItem = {
  id: string
  type: BackofficeDeletionRequestType
  targetId: string
  requestedByProfileId: string
  requestedByEmail: string | null
  requestedByName: string | null
  status: BackofficeDeletionRequestStatus
  reason: string | null
  snapshot: unknown
  createdAt: Date
  executedAt: Date | null
  approvals: Array<{
    id: string
    approverProfileId: string
    approverEmail: string | null
    decision: BackofficeDeletionApprovalDecision
    createdAt: Date
  }>
}

export interface IBackofficeDeletionRequestRepository {
  create(input: {
    type: BackofficeDeletionRequestType
    targetId: string
    requestedByProfileId: string
    reason?: string | null
    snapshot?: unknown
  }): Promise<{ id: string }>

  findById(id: string): Promise<BackofficeDeletionRequestListItem | null>

  list(input?: { status?: BackofficeDeletionRequestStatus }): Promise<BackofficeDeletionRequestListItem[]>

  findPendingForTarget(
    type: BackofficeDeletionRequestType,
    targetId: string
  ): Promise<{ id: string } | null>

  createApproval(input: {
    requestId: string
    approverProfileId: string
    decision: BackofficeDeletionApprovalDecision
  }): Promise<void>

  updateStatus(
    id: string,
    status: BackofficeDeletionRequestStatus,
    executedAt?: Date | null
  ): Promise<void>

  findProfileSnapshot(profileId: string): Promise<{
    id: string
    email: string
    fullName: string | null
    isMaster: boolean
    deletedAt: Date | null
  } | null>

  findTeamSnapshot(teamId: string): Promise<{
    id: string
    name: string
    masterId: string
    deletedAt: Date | null
  } | null>

  findApproverProfileIdsByEmails(emails: string[]): Promise<Array<{ id: string; email: string }>>
}
