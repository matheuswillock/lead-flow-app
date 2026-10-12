import type { AsaasCardReauthorizationAttemptStatus } from "@prisma/client"

export type AuthorizedCardReauthorization = {
  id: string
  expiresAt: Date
  usedAt: Date | null
  isBanned: boolean
  migration: {
    profileId: string
    clientName: string
    status: string
    quoteSnapshot: unknown
    legacyCustomerId: string
    primaryCustomerId: string | null
  }
}

export type AuthenticatedCardRecoveryMigration = {
  id: string
  isBanned: boolean
  primaryCustomerId: string | null
  status: string
}


export type CardProcessingClaim =
  | { kind: "claimed"; attemptId: string; attemptReference: string }
  | { kind: "already_processing" }
  | { kind: "invalid_or_expired" }
  | { kind: "rate_limited"; retryAt: Date }

export type ClaimCardProcessingInput = {
  id: string
  masterProfileId: string
  processingOwner: string
  now: Date
  leaseDurationMs: number
}

export type CompleteCardAttemptInput = {
  attemptId: string
  status: Exclude<AsaasCardReauthorizationAttemptStatus, "processing">
  failureCode?: string | null
  completedAt: Date
}

export interface IAsaasCardReauthorizationRepository {
  createToken(migrationId: string, expiresAt: Date): Promise<string>
  findRecoveryMigrationForAuthenticatedMaster(
    supabaseId: string
  ): Promise<AuthenticatedCardRecoveryMigration | null>
  findForMaster(token: string, supabaseId: string): Promise<AuthorizedCardReauthorization | null>
  markUsed(id: string): Promise<void>
  claimForProcessing(input: ClaimCardProcessingInput): Promise<CardProcessingClaim>
  releaseProcessing(id: string, processingOwner: string): Promise<boolean>
  completeAttempt(input: CompleteCardAttemptInput): Promise<boolean>
}
