export type BackofficeDeletionRequestType = "USER_DELETE" | "TEAM_DELETE"
export type BackofficeDeletionRequestStatus = "pending" | "approved" | "rejected" | "cancelled"
export type BackofficeDeletionRequestStatusFilter = BackofficeDeletionRequestStatus | "all"
export type BackofficeDeletionApprovalDecision = "approved" | "rejected"

export interface BackofficeDeletionRequestSnapshot {
  email?: string
  fullName?: string
  name?: string
  isMaster?: boolean
  masterId?: string
}

export interface BackofficeDeletionRequestApproval {
  id: string
  approverProfileId: string
  approverEmail: string
  decision: BackofficeDeletionApprovalDecision
  createdAt: string
}

export interface BackofficeDeletionRequestItem {
  id: string
  type: BackofficeDeletionRequestType
  targetId: string
  requestedByProfileId: string
  requestedByEmail: string
  requestedByName: string | null
  status: BackofficeDeletionRequestStatus
  reason: string | null
  snapshot: BackofficeDeletionRequestSnapshot | null
  createdAt: string
  executedAt: string | null
  approvals: BackofficeDeletionRequestApproval[]
}

export interface BackofficeApprovalsListResult {
  items: BackofficeDeletionRequestItem[]
}

export interface BackofficeApprovalsFilters {
  status: BackofficeDeletionRequestStatusFilter
}

export interface BackofficeApprovalDecisionResult {
  id: string
  status: BackofficeDeletionRequestStatus
  approvals?: number
}
