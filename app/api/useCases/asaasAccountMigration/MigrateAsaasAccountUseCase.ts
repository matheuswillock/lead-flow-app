import type { AsaasAccountMigration } from "@prisma/client"
import type { IAsaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/IAsaasCustomerGateway"
import type { IAsaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/IAsaasMigrationGateway"
import type { IAsaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/IAsaasAccountMigrationRepository"
import type { ISubscriptionPointerRepository } from "@/app/api/infra/data/repositories/subscriptions/ISubscriptionPointerRepository"
import type { BillingQuote } from "@/app/api/shared/billing/billingQuoteTypes"
import { Output } from "@/lib/output"
import { randomUUID } from "node:crypto"
import type { MigrationReadinessService } from "./MigrationReadinessService"

const MIGRATION_LEASE_DURATION_MS = 10 * 60 * 1000

export type MigrationInput = {
  legacyCustomerId: string
  quote: BillingQuote
  now?: Date
  creditCardToken?: string
  remoteIp?: string
  /** Referência gerada por um use case interno; rotas não devem preencher. */
  internalPaymentReference?: string
  /** Owner interno do lease; nunca vem de rota. */
  leaseOwner?: string
}

type MigrationFailureReason = "declined" | "unknown" | "manual_review"

function toAsaasCycle(cycle: BillingQuote["billingCycle"]): string {
  const cycles: Record<string, string> = {
    monthly: "MONTHLY",
    quarterly: "QUARTERLY",
    quadrimester: "QUADRIMESTERLY",
    semiannual: "SEMIANNUALLY",
    annual: "YEARLY",
  }
  const result = cycle ? cycles[cycle] : undefined
  if (!result) throw new Error("Ciclo de cobrança ausente ou inválido")
  return result
}

function nextDueDate(anchor: Date, cycle: BillingQuote["billingCycle"]): string {
  // nextDueDate é um calendário persistido (timestamp à meia-noite UTC); usar
  // os componentes UTC evita deslocar o dia ao converter para São Paulo.
  const year = anchor.getUTCFullYear()
  const month = anchor.getUTCMonth() + 1
  const day = anchor.getUTCDate()
  const months = cycle === "quarterly" ? 3 : cycle === "quadrimester" ? 4 : cycle === "semiannual" ? 6 : cycle === "annual" ? 12 : 1
  const targetMonth = month - 1 + months
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = targetMonth % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return [targetYear, String(normalizedMonth + 1).padStart(2, "0"), String(Math.min(day, lastDay)).padStart(2, "0")].join("-")
}

function isDue(now: Date, dueDate: Date | null): boolean {
  if (!dueDate) return false
  const calendarDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const dueCivilDate = [
    dueDate.getUTCFullYear(),
    String(dueDate.getUTCMonth() + 1).padStart(2, "0"),
    String(dueDate.getUTCDate()).padStart(2, "0"),
  ].join("-")
  return calendarDate.format(now) >= dueCivilDate
}

function sameAmount(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.005
}

function persistedCivilDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function saoPauloCivilDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function daysUntilDue(now: Date, dueDate: Date | null): number | null {
  if (!dueDate) return null
  const nowCivil = new Date(`${saoPauloCivilDate(now)}T12:00:00.000Z`)
  const dueCivil = new Date(`${persistedCivilDate(dueDate)}T12:00:00.000Z`)
  return Math.ceil((dueCivil.getTime() - nowCivil.getTime()) / 86_400_000)
}

function isCurrentCyclePayment(paymentDueDate: string | null | undefined, nextDueDate: Date | null): boolean {
  if (!paymentDueDate || !nextDueDate) return false
  return paymentDueDate.slice(0, 10) === persistedCivilDate(nextDueDate)
}

const CONFIRMED_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"])
const PAYABLE_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE"])

export class MigrateAsaasAccountUseCase {
  constructor(
    private readonly dependencies: {
      ledgerRepository: IAsaasAccountMigrationRepository
      customerGateway: IAsaasCustomerGateway
      migrationGateway: IAsaasMigrationGateway
      pointerRepository: ISubscriptionPointerRepository
      readinessService?: MigrationReadinessService
    }
  ) {}

  async execute(input: MigrationInput): Promise<Output> {
    try {
      let migration = await this.dependencies.ledgerRepository.findByLegacyCustomerId(input.legacyCustomerId)
      if (!migration) return new Output(false, [], ["Registro de migração não encontrado"], null)
      if (input.internalPaymentReference && !/^[A-Za-z0-9:_-]{1,100}$/.test(input.internalPaymentReference)) {
        return new Output(false, [], ["Referência externa de pagamento inválida"], { reason: "manual_review" })
      }
      if (migration.profileId !== input.quote.billingOwnerId) return new Output(false, [], ["Quote não pertence ao cliente da migração"], null)
      if (input.quote.status === "blocked") return new Output(false, [], ["Quote bloqueado; migração interrompida"], null)
      if (this.dependencies.readinessService) {
        try {
          await this.dependencies.readinessService.assertReady(
            migration,
            input.now ?? new Date(),
          )
        } catch (error) {
          return new Output(
            false,
            [],
            [error instanceof Error ? error.message : "Migração sem readiness aprovado"],
            { reason: "not_ready" },
          )
        }
      }
      await this.dependencies.ledgerRepository.recordQuoteSnapshot?.(input.legacyCustomerId, input.quote)
      if (migration.status === "done") return new Output(true, ["Migração já concluída"], [], this.result(migration))
      if (migration.status === "failed") {
        const resumed = await this.dependencies.ledgerRepository.resumeFailedExecution?.(input.legacyCustomerId)
        if (!resumed) return new Output(false, [], ["Migração failed sem checkpoint de retomada"], this.result(migration))
        migration = resumed
      }

      const leaseOwner = randomUUID()
      const claim = await this.dependencies.ledgerRepository.claimForExecution?.(
        input.legacyCustomerId,
        leaseOwner,
        new Date(),
        MIGRATION_LEASE_DURATION_MS,
      )
      if (this.dependencies.ledgerRepository.claimForExecution && !claim) {
        return new Output(
          false,
          [],
          ["Migração já está sendo processada"],
          { reason: "already_processing" },
        )
      }
      input.leaseOwner = leaseOwner

      const now = input.now ?? new Date()
      let current = migration
      let legacyAlreadyInactive =
        Boolean(migration.legacyRemovedAt) ||
        ["legacy_removed", "paused_awaiting_card", "initial_payment_confirmed"].includes(
          migration.status,
        )

      const renewLease = async (): Promise<void> => {
        if (!this.dependencies.ledgerRepository.renewExecutionLease) return
        const renewed = await this.dependencies.ledgerRepository.renewExecutionLease(
          input.legacyCustomerId,
          leaseOwner,
          new Date(),
          MIGRATION_LEASE_DURATION_MS,
        )
        if (!renewed) throw new Error("Lease da migração expirou antes do efeito externo")
      }

      const transition = async (
        transitionInput: Parameters<IAsaasAccountMigrationRepository["transition"]>[0],
      ): Promise<AsaasAccountMigration> => {
        await renewLease()
        return this.dependencies.ledgerRepository.transition({
          ...transitionInput,
          leaseOwner: this.dependencies.ledgerRepository.claimForExecution
            ? leaseOwner
            : undefined,
          leaseNow: new Date(),
        })
      }

      const inactivateLegacy = async (): Promise<Output | null> => {
        if (!current.legacySubscriptionId) return this.fail(input, "Assinatura legada ausente")
        await renewLease()
        if (
          this.dependencies.migrationGateway.listLegacySubscriptionPayments &&
          this.dependencies.migrationGateway.findLegacySubscription &&
          this.dependencies.migrationGateway.inactivateLegacySubscription
        ) {
          const payments = await this.dependencies.migrationGateway.listLegacySubscriptionPayments(
            current.legacySubscriptionId,
          )
          if (payments.some((payment) => CONFIRMED_PAYMENT_STATUSES.has(payment.status) && isCurrentCyclePayment(payment.dueDate, current.nextDueDate))) {
            return this.fail(
              input,
              "Pagamento legado confirmado no ciclo; revisão manual necessária",
            )
          }
          for (const payment of payments.filter((item) => PAYABLE_PAYMENT_STATUSES.has(item.status))) {
            if (!this.dependencies.migrationGateway.cancelLegacyPayment) {
              return this.fail(input, "Gateway não consegue cancelar cobrança legada pagável")
            }
            await renewLease()
            const canceled = await this.dependencies.migrationGateway.cancelLegacyPayment(payment.id)
            if (!canceled) return this.fail(input, "Asaas não confirmou o cancelamento da cobrança legada")
          }
          const remaining = await this.dependencies.migrationGateway.listLegacySubscriptionPayments(
            current.legacySubscriptionId,
          )
          if (remaining.some((payment) => PAYABLE_PAYMENT_STATUSES.has(payment.status))) {
            return this.fail(input, "Cobrança legada ainda está pagável; revisão manual necessária")
          }
          let legacy = await this.dependencies.migrationGateway.findLegacySubscription(
            current.legacySubscriptionId,
          )
          if (legacy && legacy.status !== "INACTIVE") {
            await renewLease()
            await this.dependencies.migrationGateway.inactivateLegacySubscription(
              current.legacySubscriptionId,
            )
            legacy = await this.dependencies.migrationGateway.findLegacySubscription(
              current.legacySubscriptionId,
            )
          }
          if (legacy && legacy.status !== "INACTIVE") {
            return this.fail(input, "Asaas não confirmou a inativação da assinatura legada")
          }
        } else {
          const removed = await this.dependencies.migrationGateway.removeLegacySubscription(
            current.legacySubscriptionId,
          )
          if (!removed.deleted) {
            return this.fail(input, "Asaas não confirmou a remoção da assinatura legada")
          }
        }
        return null
      }

      try {

      if (current.status === "pending") {
        await renewLease()
        const customer = (await this.dependencies.customerGateway.findCustomerByExternalReference?.(current.profileId)) ??
          await this.dependencies.customerGateway.createCustomer({
            profileId: current.profileId,
            name: current.clientName,
            email: current.clientEmail,
          })
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "customer_created",
          primaryCustomerId: customer.id,
        })
      }

      if (current.status === "customer_created") {
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "awaiting_due_date",
        })
      }

      if (current.status === "awaiting_due_date") {
        const daysRemaining = daysUntilDue(now, current.nextDueDate)
        if (!isDue(now, current.nextDueDate)) {
          if (daysRemaining !== null && daysRemaining <= 7) {
            current = await transition({
              legacyCustomerId: input.legacyCustomerId,
              toStatus: "requires_card_reauth",
            })
            return new Output(true, ["Reautorização antecipada necessária"], [], this.result(current))
          }
          return new Output(true, ["Migração aguardando vencimento"], [], this.result(current))
        }
      }

      if (current.status === "requires_card_reauth" && !isDue(now, current.nextDueDate)) {
        return new Output(true, ["Migração aguardando vencimento"], [], this.result(current))
      }

      if (
        ["awaiting_due_date", "requires_card_reauth", "legacy_removed"].includes(current.status) &&
        isDue(now, current.nextDueDate)
      ) {
        if (!legacyAlreadyInactive) {
          const inactivationFailure = await inactivateLegacy()
          if (inactivationFailure) return inactivationFailure
          legacyAlreadyInactive = true
        }
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "paused_awaiting_card",
          legacyRemovedAt: now,
          anomalyNotes: "Assinatura legada inativada no vencimento após reconciliação de cobranças",
        })
        if (!input.creditCardToken) {
          return new Output(true, ["Acesso pausado; reautorização de cartão necessária"], [], this.result(current))
        }
      }

      if (current.status === "paused_awaiting_card") {
        if (!input.creditCardToken) {
          return new Output(true, ["Acesso pausado; reautorização de cartão necessária"], [], this.result(current))
        }
        if (!current.primaryCustomerId || !input.remoteIp) return this.fail(input, "Dados da cobrança primária incompletos")
        const paymentReference =
          input.internalPaymentReference ??
          `asaas-migration:${current.id}:initial-payment:${current.attemptCount}`
        await renewLease()
        const payment = (await this.dependencies.migrationGateway.findPaymentByExternalReference?.(paymentReference)) ??
          await this.dependencies.migrationGateway.createImmediatePayment({
            account: "primary",
            customerId: current.primaryCustomerId,
            value: input.quote.recurringAmount,
            externalReference: paymentReference,
            creditCardToken: input.creditCardToken,
            remoteIp: input.remoteIp,
          })
        if (payment.customer !== current.primaryCustomerId || !sameAmount(payment.value, input.quote.recurringAmount)) {
          return this.fail(input, "Pagamento reconciliado divergente; revisão manual necessária")
        }
        if (!CONFIRMED_PAYMENT_STATUSES.has(payment.status)) {
          return this.fail(input, `Pagamento inicial recusado: ${payment.status}`)
        }
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "initial_payment_confirmed",
          primaryPaymentId: payment.id,
          reauthorizationCompletedAt: now,
        })
      }

      if (current.status === "initial_payment_confirmed") {
        if (!current.primaryCustomerId || !input.creditCardToken) return this.fail(input, "Token do cartão indisponível para criar recorrência")
        const subscriptionReference = `asaas-migration:${current.id}:subscription`
        const expectedNextDueDate = nextDueDate(current.nextDueDate ?? now, input.quote.billingCycle)
        await renewLease()
        const subscription = (await this.dependencies.migrationGateway.findSubscriptionByExternalReference?.(subscriptionReference)) ??
          await this.dependencies.migrationGateway.createSubscription({
            account: "primary",
            customerId: current.primaryCustomerId,
            value: input.quote.recurringAmount,
            cycle: toAsaasCycle(input.quote.billingCycle),
            nextDueDate: expectedNextDueDate,
            externalReference: subscriptionReference,
            creditCardToken: input.creditCardToken,
          })
        if (
          subscription.customer !== current.primaryCustomerId ||
          !sameAmount(subscription.value, input.quote.recurringAmount) ||
          subscription.cycle !== toAsaasCycle(input.quote.billingCycle) ||
          subscription.nextDueDate !== expectedNextDueDate ||
          subscription.status !== "ACTIVE"
        ) {
          return this.fail(input, "Assinatura reconciliada divergente; revisão manual necessária")
        }
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "subscription_created",
          primarySubscriptionId: subscription.id,
          primaryCustomerId: current.primaryCustomerId,
          reauthorizationCompletedAt: now,
        })
      }

      if (current.status === "legacy_removed") {
        if (!input.creditCardToken) {
          current = await transition({
            legacyCustomerId: input.legacyCustomerId,
            toStatus: "requires_card_reauth",
          })
          return new Output(true, ["Reautorização de cartão necessária"], [], this.result(current))
        }
        return this.fail(input, "Estado legado removido exige retomada manual")
      }

      if (current.status === "subscription_created") {
        if (!current.primarySubscriptionId || !current.primaryCustomerId) return this.fail(input, "Ponteiros primary incompletos")
        if (!legacyAlreadyInactive) {
          const inactivationFailure = await inactivateLegacy()
          if (inactivationFailure) return inactivationFailure
          legacyAlreadyInactive = true
        }
        await renewLease()
        await this.dependencies.pointerRepository.migrateSubscriptionPointers({
          profileId: current.profileId,
          previousSubscriptionId: current.legacySubscriptionId,
          newSubscriptionId: current.primarySubscriptionId,
          account: "primary",
          subscriptionNextDueDate: new Date(
            `${nextDueDate(current.nextDueDate ?? now, input.quote.billingCycle)}T12:00:00.000Z`,
          ),
          subscriptionCycle: input.quote.billingCycle ?? undefined,
          operatorCount: input.quote.billableActiveMembers,
        })
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "legacy_deactivated",
        })
      }

      if (current.status === "legacy_deactivated") {
        current = await transition({
          legacyCustomerId: input.legacyCustomerId,
          toStatus: "done",
        })
      }
        return new Output(true, ["Migração Asaas concluída"], [], this.result(current))
      } finally {
        await this.dependencies.ledgerRepository.releaseExecutionLease?.(input.legacyCustomerId, leaseOwner)
      }
    } catch (error) {
      console.error("[MigrateAsaasAccountUseCase] Falha na migração", error)
      return new Output(false, [], [error instanceof Error ? error.message : "Falha na migração Asaas"], null)
    }
  }

  private async fail(input: MigrationInput, message: string): Promise<Output> {
    const current = await this.dependencies.ledgerRepository.findByLegacyCustomerId(input.legacyCustomerId)
    if (current && current.status !== "failed" && current.status !== "done") {
      const reason = this.failureReason(message)
      const failureCode =
        reason === "manual_review"
          ? `MANUAL:${message}`
          : reason === "declined"
            ? `DECLINED:${message}`
            : `TRANSIENT:${message}`
      await this.dependencies.ledgerRepository.transition({
        legacyCustomerId: input.legacyCustomerId,
        toStatus: "failed",
        lastError: message,
        failureStep: current.status,
        failureCode,
        resumeStatus: current.status,
        leaseOwner: input.leaseOwner,
        leaseNow: new Date(),
      })
    }
    return new Output(false, [], [message], {
      reason: this.failureReason(message),
    })
  }

  private failureReason(message: string): MigrationFailureReason {
    if (
      message.includes("divergente") ||
      message.includes("confirmado no ciclo") ||
      message.includes("ainda está pagável")
    ) {
      return "manual_review"
    }
    if (message.includes("recusado")) return "declined"
    return "unknown"
  }

  private result(migration: AsaasAccountMigration) {
    return {
      legacyCustomerId: migration.legacyCustomerId,
      status: migration.status,
      primaryCustomerId: migration.primaryCustomerId,
      primarySubscriptionId: migration.primarySubscriptionId,
      primaryPaymentId: migration.primaryPaymentId,
    }
  }
}
