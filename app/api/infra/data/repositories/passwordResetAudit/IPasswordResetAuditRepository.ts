export type PasswordResetFlowStatusValue =
  | "requested"
  | "link_generated"
  | "email_sent"
  | "verification_pending"
  | "token_verified"
  | "completed"
  | "expired"
  | "invalidated"
  | "failed"

export type PasswordResetEventTypeValue =
  | "requested"
  | "link_generated"
  | "email_sent"
  | "email_failed"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "page_opened"
  | "verification_started"
  | "token_verified"
  | "token_rejected"
  | "password_updated"
  | "password_update_failed"
  | "expired"
  | "invalidated"
  | "failed"

export interface PasswordResetAuditEventInput {
  type: PasswordResetEventTypeValue
  requestId?: string | null
  failureCode?: string | null
  ipHash?: string | null
  userAgent?: string | null
  occurredAt?: Date
}

export interface CreatePasswordResetFlowInput {
  profileId: string | null
  recipientEmail: string
  status: PasswordResetFlowStatusValue
  ipHash: string | null
  userAgent: string | null
  originScreen: string | null
  event: PasswordResetAuditEventInput
}

export interface RecordPasswordResetEventInput extends PasswordResetAuditEventInput {
  flowId: string
}

export interface UpdatePasswordResetFlowInput {
  flowId: string
  status?: PasswordResetFlowStatusValue
  linkGeneratedAt?: Date
  emailSentAt?: Date
  tokenVerifiedAt?: Date
  completedAt?: Date
  failureCode?: string | null
  dispatchId?: string | null
  resendEmailId?: string | null
}

export interface PasswordResetFlowOwnership {
  id: string
  status: PasswordResetFlowStatusValue
}

export interface IPasswordResetAuditRepository {
  createFlow(input: CreatePasswordResetFlowInput): Promise<{ id: string }>
  recordEvent(input: RecordPasswordResetEventInput): Promise<void>
  updateFlow(input: UpdatePasswordResetFlowInput): Promise<void>
  findFlowById(flowId: string): Promise<PasswordResetFlowOwnership | null>
}
