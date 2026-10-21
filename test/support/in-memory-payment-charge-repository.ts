import type { PaymentCharge, PaymentChargeEvent } from "@prisma/client"
import type {
  ChargeExternalIdentity,
  CreatePaymentChargeInput,
  IPaymentChargeRepository,
  ListMirrorChargesInput,
  PaymentChargeBackfill,
  TransitionPaymentChargeInput,
} from "@/app/api/infra/data/repositories/paymentCharge/IPaymentChargeRepository"

/** Fake em memória com as mesmas unicidades do banco (inclusive as parciais). */
export class InMemoryPaymentChargeRepository implements IPaymentChargeRepository {
  readonly charges: PaymentCharge[] = []
  readonly events: PaymentChargeEvent[] = []
  failNextCreate: Error | null = null
  /** Simula outro processo inserindo a linha entre a leitura e a criação. */
  beforeCreate: (() => Promise<void>) | null = null
  private sequence = 0

  async create(input: CreatePaymentChargeInput): Promise<PaymentCharge> {
    if (this.beforeCreate) {
      const hook = this.beforeCreate
      this.beforeCreate = null
      await hook()
    }
    if (this.failNextCreate) {
      const error = this.failNextCreate
      this.failNextCreate = null
      throw error
    }
    this.assertUnique(input)
    const { actor, paymentInstructions, ...rest } = input
    this.sequence += 1
    const now = new Date("2026-10-21T12:00:00.000Z")
    const charge = {
      id: `charge-${this.sequence}`,
      subscriptionId: null,
      purposeRefId: null,
      rawStatus: null,
      currency: "BRL",
      method: null,
      cycleKey: null,
      dueDate: null,
      paidAt: null,
      providerSessionId: null,
      providerAttemptId: null,
      providerExternalId: null,
      paymentInstructions: paymentInstructions ?? null,
      createdAt: now,
      updatedAt: now,
      ...rest,
    } as unknown as PaymentCharge
    this.charges.push(charge)
    this.pushEvent(charge.id, null, charge.status, charge.rawStatus, actor)
    return charge
  }

  async findById(id: string) {
    return this.charges.find((charge) => charge.id === id) ?? null
  }

  async findByIdempotencyKey(input: { profileId: string; idempotencyKey: string }) {
    return (
      this.charges.find(
        (charge) =>
          charge.profileId === input.profileId && charge.idempotencyKey === input.idempotencyKey,
      ) ?? null
    )
  }

  async findByExternalIdentity(input: ChargeExternalIdentity) {
    return (
      this.charges.find(
        (charge) =>
          charge.provider === input.provider &&
          charge.providerEnvironment === input.providerEnvironment &&
          charge.providerContext === input.providerContext &&
          charge.providerExternalId === input.providerExternalId,
      ) ?? null
    )
  }

  async findByPurposeRef(input: { purpose: string; purposeRefId: string }) {
    return (
      this.charges.find(
        (charge) => charge.purpose === input.purpose && charge.purposeRefId === input.purposeRefId,
      ) ?? null
    )
  }

  async transition(input: TransitionPaymentChargeInput) {
    const charge = this.charges.find((item) => item.id === input.id)
    if (!charge || charge.status !== input.expectedStatus) return null
    charge.status = input.toStatus
    if (input.rawStatus !== undefined) charge.rawStatus = input.rawStatus
    if (input.paidAt) charge.paidAt = input.paidAt
    this.pushEvent(charge.id, input.expectedStatus, input.toStatus, input.rawStatus ?? null, input.actor)
    return charge
  }

  async backfill(id: string, fields: PaymentChargeBackfill) {
    const charge = this.charges.find((item) => item.id === id)
    if (!charge) return null
    if (fields.providerSessionId && !charge.providerSessionId) charge.providerSessionId = fields.providerSessionId
    if (fields.providerAttemptId && !charge.providerAttemptId) charge.providerAttemptId = fields.providerAttemptId
    if (fields.providerExternalId && !charge.providerExternalId) charge.providerExternalId = fields.providerExternalId
    if (fields.paidAt && !charge.paidAt) charge.paidAt = fields.paidAt
    if (fields.rawStatus !== undefined) charge.rawStatus = fields.rawStatus
    return charge
  }

  async listEvents(chargeId: string) {
    return this.events.filter((event) => event.chargeId === chargeId)
  }

  async listForDivergence(input: ListMirrorChargesInput) {
    return this.charges
      .filter(
        (charge) =>
          input.sources.includes(charge.source as never) &&
          charge.createdAt >= input.createdAfter &&
          (!input.afterId || charge.id > input.afterId),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, input.limit)
  }

  private pushEvent(
    chargeId: string,
    fromStatus: string | null,
    toStatus: string,
    rawStatus: string | null,
    actor: string,
  ) {
    this.events.push({
      id: `event-${this.events.length + 1}`,
      chargeId,
      fromStatus,
      toStatus,
      rawStatus,
      actor,
      occurredAt: new Date("2026-10-21T12:00:00.000Z"),
    })
  }

  private assertUnique(input: CreatePaymentChargeInput) {
    const duplicatedKey = this.charges.some(
      (charge) => charge.profileId === input.profileId && charge.idempotencyKey === input.idempotencyKey,
    )
    const duplicatedCycle =
      input.subscriptionId &&
      input.cycleKey &&
      this.charges.some(
        (charge) => charge.subscriptionId === input.subscriptionId && charge.cycleKey === input.cycleKey,
      )
    const duplicatedExternal =
      input.providerExternalId &&
      this.charges.some(
        (charge) =>
          charge.provider === input.provider &&
          charge.providerEnvironment === input.providerEnvironment &&
          charge.providerContext === input.providerContext &&
          charge.providerExternalId === input.providerExternalId,
      )
    if (duplicatedKey || duplicatedCycle || duplicatedExternal) {
      throw new Error("Unique constraint failed on payment_charges")
    }
  }
}
