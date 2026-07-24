import type {
  BackofficeApprovalDecisionResult,
  BackofficeApprovalsFilters,
  BackofficeApprovalsListResult,
  BackofficeDeletionApprovalDecision,
} from "../context/BackofficeApprovalsTypes"

export interface IBackofficeApprovalsService {
  list(params?: { filters?: Partial<BackofficeApprovalsFilters> }): Promise<BackofficeApprovalsListResult>
  decide(
    requestId: string,
    decision: BackofficeDeletionApprovalDecision
  ): Promise<BackofficeApprovalDecisionResult>
}
