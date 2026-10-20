import type { PasswordResetEventType, PasswordResetFlowStatus } from "@prisma/client"

export interface PasswordResetAuditEventInput {
  type: PasswordResetEventType
  requestId?: string | null
  failureCode?: string | null
  ipHash?: string | null
  userAgent?: string | null
}

export interface CreatePasswordResetFlowInput {
  profileId: string | null
  recipientEmail: string
  status: PasswordResetFlowStatus
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
  status?: PasswordResetFlowStatus
  linkGeneratedAt?: Date
  emailSentAt?: Date
  tokenVerifiedAt?: Date
  completedAt?: Date
  failureCode?: string | null
}

export interface PasswordResetFlowOwnership {
  id: string
  status: PasswordResetFlowStatus
}

export interface IPasswordResetAuditRepository {
  createFlow(input: CreatePasswordResetFlowInput): Promise<{ id: string }>
  recordEvent(input: RecordPasswordResetEventInput): Promise<void>
  updateFlow(input: UpdatePasswordResetFlowInput): Promise<void>
  findFlowForSupabaseUser(flowId: string, supabaseId: string): Promise<PasswordResetFlowOwnership | null>
}
