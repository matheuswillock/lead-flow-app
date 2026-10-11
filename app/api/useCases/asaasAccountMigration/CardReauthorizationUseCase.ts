import type { IAsaasMigrationGateway, AsaasMigrationCard, AsaasMigrationCardholder } from "@/app/api/infra/gateways/asaasMigration/IAsaasMigrationGateway"
import type { MigrateAsaasAccountUseCase } from "./MigrateAsaasAccountUseCase"
import type { BillingQuote } from "@/app/api/shared/billing/billingQuoteTypes"
import type { IAsaasCardReauthorizationRepository } from "@/app/api/infra/data/repositories/asaasCardReauthorization/IAsaasCardReauthorizationRepository"
import { Output } from "@/lib/output"
import { randomUUID } from "node:crypto"

const CARD_REAUTH_PROCESSING_LEASE_MS = 5 * 60 * 1000

export class CardReauthorizationUseCase {
  constructor(private readonly dependencies: {
    tokenRepository: IAsaasCardReauthorizationRepository
    migrationUseCase: MigrateAsaasAccountUseCase
    migrationGateway: IAsaasMigrationGateway
  }) {}

  async getContext(token: string, supabaseId: string) {
    const record = await this.dependencies.tokenRepository.findForMaster(token, supabaseId)
    if (!record) return new Output(false, [], ["Reautorização inválida ou expirada"], null)
    if (record.usedAt || record.expiresAt <= new Date()) {
      return new Output(false, [], ["Reautorização inválida ou expirada"], { reason: "expired" })
    }
    if (record.isBanned) return new Output(false, [], ["Acesso suspenso"], { reason: "banned" })
    return new Output(true, [], [], { clientName: record.migration.clientName, status: record.migration.status, expiresAt: record.expiresAt })
  }

  async submit(input: { token: string; supabaseId: string; card: AsaasMigrationCard; cardholder: AsaasMigrationCardholder; remoteIp: string }) {
    const record = await this.dependencies.tokenRepository.findForMaster(input.token, input.supabaseId)
    if (!record || record.usedAt || record.expiresAt <= new Date()) return new Output(false, [], ["Reautorização inválida ou expirada"], null)
    if (record.isBanned) return new Output(false, [], ["Acesso suspenso"], { reason: "banned" })
    const quote = record.migration.quoteSnapshot as BillingQuote | null
    if (!quote) return new Output(false, [], ["Snapshot de cobrança ausente"], null)
    const processingOwner = randomUUID()
    const claim = await this.dependencies.tokenRepository.claimForProcessing({
        id: record.id,
        masterProfileId: record.migration.profileId,
        processingOwner,
        now: new Date(),
        leaseDurationMs: CARD_REAUTH_PROCESSING_LEASE_MS,
      })
    if (claim.kind === "rate_limited") {
      return new Output(
        false,
        [],
        ["Limite de tentativas atingido. Entre em contato com o time de assinaturas."],
        { reason: "rate_limited", retryAt: claim.retryAt },
      )
    }
    if (claim.kind === "already_processing") {
      return new Output(false, [], ["Reautorização já está em processamento"], { reason: "already_processing" })
    }
    if (claim.kind === "invalid_or_expired") {
      return new Output(false, [], ["Reautorização inválida ou expirada"], { reason: "invalid_or_expired" })
    }

    let shouldReleaseClaim = false
    try {
      const { token: creditCardToken } = await this.dependencies.migrationGateway.tokenizeCard({ customerId: record.migration.primaryCustomerId ?? "", card: input.card, cardholder: input.cardholder, remoteIp: input.remoteIp })
      const result = await this.dependencies.migrationUseCase.execute({
        legacyCustomerId: record.migration.legacyCustomerId,
        quote,
        creditCardToken,
        remoteIp: input.remoteIp,
        paymentExternalReference: `asaas-card-migration:${record.migration.legacyCustomerId}`,
      })
      if (result.isValid) {
        await this.completeAttempt(claim.attemptId, "confirmed", null)
        await this.dependencies.tokenRepository.markUsed(record.id)
      } else {
        const reason = (result.result as { reason?: string } | null)?.reason
        if (reason === "declined") {
          shouldReleaseClaim = true
          await this.completeAttempt(claim.attemptId, "declined", "PAYMENT_DECLINED")
        } else {
          await this.completeAttempt(claim.attemptId, "unknown", "REMOTE_OUTCOME_UNKNOWN")
        }
      }
      return result
    } catch (error) {
      if (this.isKnownDecline(error)) {
        shouldReleaseClaim = true
        await this.completeAttempt(claim.attemptId, "declined", "CARD_DECLINED")
      } else {
        await this.completeAttempt(claim.attemptId, "unknown", "REMOTE_OUTCOME_UNKNOWN")
      }
      throw error
    } finally {
      if (shouldReleaseClaim) {
        await this.dependencies.tokenRepository.releaseProcessing(record.id, processingOwner)
      }
    }
  }

  private async completeAttempt(
    attemptId: string,
    status: "confirmed" | "declined" | "unknown",
    failureCode: string | null,
  ): Promise<void> {
    try {
      await this.dependencies.tokenRepository.completeAttempt({
        attemptId,
        status,
        failureCode,
        completedAt: new Date(),
      })
    } catch (recordError) {
      console.error("[CardReauthorizationUseCase] Falha ao registrar tentativa", recordError)
    }
  }

  private isKnownDecline(error: unknown): boolean {
    const statusCode = (error as { statusCode?: unknown } | null)?.statusCode
    return (
      typeof statusCode === "number" &&
      statusCode >= 400 &&
      statusCode < 500 &&
      ![408, 409, 425, 429].includes(statusCode)
    )
  }
}
