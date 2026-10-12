import { Output } from "@/lib/output"

type RecoveryMigration = {
  id: string
  isBanned: boolean
  primaryCustomerId: string | null
  status: string
  quoteSnapshot: unknown
  isPaymentPaused: boolean
}

export class CreateAuthenticatedCardReauthorizationLinkUseCase {
  constructor(
    private readonly dependencies: {
      recoveryRepository: {
        findRecoveryMigrationForAuthenticatedMaster(supabaseId: string): Promise<RecoveryMigration | null>
      }
      tokenRepository: {
        createToken(migrationId: string, expiresAt: Date): Promise<string>
      }
      now?: () => Date
    }
  ) {}

  async execute(input: { supabaseId: string }): Promise<Output> {
    const migration = await this.dependencies.recoveryRepository.findRecoveryMigrationForAuthenticatedMaster(input.supabaseId)
    if (
      !migration ||
      migration.isBanned ||
      !migration.primaryCustomerId ||
      migration.status !== "paused_awaiting_card" || !migration.quoteSnapshot || !migration.isPaymentPaused
    ) {
      return new Output(false, [], ["Regularização ainda não está disponível para esta conta"], null)
    }

    const now = this.dependencies.now?.() ?? new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const token = await this.dependencies.tokenRepository.createToken(migration.id, expiresAt)
    return new Output(true, [], [], { token })
  }
}
