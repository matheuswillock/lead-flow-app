import { createHash, randomUUID } from "node:crypto"
import { PaymentProviderSessionStatus as PrismaSessionStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  assertAttemptStatusTransition,
  PaymentProviderLeaseError,
  type ProviderLeaseState,
} from "@/lib/payment-provider/session"
import type { PaymentAttemptStatus, ProviderPixInstructions } from "@/lib/payment-provider/types"
import type {
  AcquirePaymentProviderAttemptLeaseInput,
  CreatePaymentProviderAttemptInput,
  CreatePaymentProviderSessionInput,
  ApplyPaymentProviderEventInput,
  IPaymentProviderSessionRepository,
  PaymentProviderAttemptRecord,
  PaymentProviderSessionRecord,
  StoredPaymentProviderAttemptRecord,
  UpdatePaymentProviderAttemptInput,
} from "./IPaymentProviderSessionRepository"

const sessionSelect = {
  id: true,
  tenantId: true,
  ownerType: true,
  ownerId: true,
  idempotencyKey: true,
  environment: true,
  providerKey: true,
  externalAccountContext: true,
  route: true,
  routeVersion: true,
  status: true,
  leaseToken: true,
  leaseUntil: true,
  fenceVersion: true,
  expiresAt: true,
} as const

const attemptSelect = {
  id: true,
  sessionId: true,
  attemptNumber: true,
  idempotencyKey: true,
  requestFingerprint: true,
  providerKey: true,
  environment: true,
  externalAccountContext: true,
  status: true,
  externalId: true,
  reconciliationReference: true,
  leaseToken: true,
  leaseUntil: true,
  fenceVersion: true,
  unknownReason: true,
  lastEventClaimToken: true,
  paymentInstructions: true,
  session: {
    select: {
      tenantId: true,
      ownerType: true,
      ownerId: true,
    },
  },
} as const

export class PaymentProviderSessionRepository implements IPaymentProviderSessionRepository {
  async createSession(
    input: CreatePaymentProviderSessionInput,
  ): Promise<PaymentProviderSessionRecord> {
    const session = await prisma.paymentProviderSession.upsert({
      where: {
        tenantId_ownerType_ownerId_idempotencyKey: {
          tenantId: input.tenantId,
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        idempotencyKey: input.idempotencyKey,
        environment: input.environment,
        providerKey: input.provider,
        externalAccountContext: input.externalAccountContext,
        route: input.route,
        routeVersion: input.routeVersion,
        expiresAt: input.expiresAt,
      },
      update: {},
      select: sessionSelect,
    })
    assertSessionBindingMatches(session, input)
    return toSessionRecord(session)
  }

  async createAttempt(
    input: CreatePaymentProviderAttemptInput,
  ): Promise<StoredPaymentProviderAttemptRecord> {
    const attempt = await prisma.$transaction(
      async (transaction) => {
        const session = await transaction.paymentProviderSession.findUnique({
          where: { id: input.sessionId },
          select: {
            providerKey: true,
            environment: true,
            externalAccountContext: true,
            status: true,
            expiresAt: true,
            tenantId: true,
            ownerType: true,
            ownerId: true,
          },
        })
        if (
          !session ||
          session.tenantId !== input.tenantId ||
          session.ownerType !== input.ownerType ||
          session.ownerId !== input.ownerId ||
          session.status !== "OPEN" ||
          session.expiresAt.getTime() <= input.now.getTime() ||
          session.providerKey !== input.provider ||
          session.environment !== input.environment ||
          session.externalAccountContext !== input.externalAccountContext
        ) {
          throw new Error("A tentativa não corresponde ao binding da sessão")
        }
        const requestFingerprint = hashRequestFingerprint(input.requestFingerprint)
        const latestAttempt = await transaction.paymentProviderAttempt.findFirst({
          where: { sessionId: input.sessionId },
          orderBy: { attemptNumber: "desc" },
          select: { attemptNumber: true },
        })
        const nextAttemptNumber = latestAttempt
          ? latestAttempt.attemptNumber + 1
          : input.attemptNumber
        const attempt = await transaction.paymentProviderAttempt.upsert({
          where: {
            providerKey_environment_externalAccountContext_idempotencyKey: {
              providerKey: input.provider,
              environment: input.environment,
              externalAccountContext: input.externalAccountContext,
              idempotencyKey: input.idempotencyKey,
            },
          },
          create: {
            sessionId: input.sessionId,
            attemptNumber: nextAttemptNumber,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint,
            providerKey: input.provider,
            environment: input.environment,
            externalAccountContext: input.externalAccountContext,
          },
          update: {},
          select: attemptSelect,
        })
        assertAttemptBindingMatches(attempt, input, requestFingerprint)
        const unresolvedAttempt = await transaction.paymentProviderAttempt.findFirst({
          where: {
            status: "UNKNOWN",
            session: {
              is: {
                tenantId: input.tenantId,
                ownerType: input.ownerType,
                ownerId: input.ownerId,
              },
            },
          },
          select: { id: true },
        })
        if (unresolvedAttempt && unresolvedAttempt.id !== attempt.id) {
          throw new Error("O checkout possui tentativa UNKNOWN pendente de reconciliação")
        }
        return attempt
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    return toAttemptRecord(attempt)
  }

  async acquireAttemptLease(
    input: AcquirePaymentProviderAttemptLeaseInput,
  ): Promise<StoredPaymentProviderAttemptRecord> {
    validateLeaseTtl(input.ttlMs)
    const leaseToken = randomUUID()
    const leaseUntil = new Date(input.now.getTime() + input.ttlMs)
    return prisma.$transaction(async (transaction) => {
      // Only payment initiation requires a live checkout session; reconciliation
      // and post-payment flows (refunds, entitlement grants) may run after the
      // session expiry.
      const sessionLifecycle =
        input.purpose === "PAYMENT"
          ? { status: PrismaSessionStatus.OPEN, expiresAt: { gt: input.now } }
          : { status: { in: [PrismaSessionStatus.OPEN, PrismaSessionStatus.EXPIRED] } }
      const result = await transaction.paymentProviderAttempt.updateMany({
        where: {
          id: input.attemptId,
          status:
            input.purpose === "RECONCILIATION"
              ? { in: ["UNKNOWN"] }
              : input.purpose === "POST_PAYMENT"
                ? { in: ["CONFIRMED", "DISPUTED"] }
                : { in: ["CREATED", "PENDING"] },
          session: {
            is: {
              tenantId: input.tenantId,
              ownerType: input.ownerType,
              ownerId: input.ownerId,
              ...sessionLifecycle,
            },
          },
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: input.now } }],
        },
        data: { leaseToken, leaseUntil, fenceVersion: { increment: 1 } },
      })
      if (result.count !== 1) {
        throw new PaymentProviderLeaseError("LEASE_HELD", "A tentativa não possui lease disponível")
      }
      const attempt = await transaction.paymentProviderAttempt.findFirst({
        where: { id: input.attemptId, leaseToken },
        select: attemptSelect,
      })
      if (!attempt) {
        throw new PaymentProviderLeaseError(
          "STALE_TOKEN",
          "A lease foi substituída antes da leitura",
        )
      }
      return toAttemptRecord(attempt)
    })
  }

  async updateAttemptWithLease(
    input: UpdatePaymentProviderAttemptInput,
  ): Promise<StoredPaymentProviderAttemptRecord> {
    if (input.expectedStatus === "UNKNOWN" && input.operation !== "RECONCILIATION") {
      throw new Error("Tentativa UNKNOWN exige operação explícita de reconciliação")
    }
    assertAttemptStatusTransition(input.expectedStatus, input.status)
    const normalizedExternalId = normalizeExternalId(input.externalId)
    if (["CONFIRMED", "REFUNDED", "DISPUTED"].includes(input.status) && !normalizedExternalId) {
      throw new Error("Estado de pagamento exige id externo")
    }
    const externalIdScope = normalizedExternalId
      ? { OR: [{ externalId: null }, { externalId: normalizedExternalId }] }
      : {}
    const externalIdData =
      normalizedExternalId === undefined ? {} : { externalId: normalizedExternalId }
    const result = await prisma.paymentProviderAttempt.updateMany({
      // Only payment initiation requires a live checkout session; reconciliation
      // and post-payment operations may finish after the checkout expiry.
      where: {
        id: input.attemptId,
        status: input.expectedStatus,
        leaseToken: input.lease.leaseToken,
        fenceVersion: input.lease.fenceVersion,
        leaseUntil: { gt: input.now },
        session: {
          is: {
            tenantId: input.tenantId,
            ownerType: input.ownerType,
            ownerId: input.ownerId,
            ...(input.operation === "PAYMENT"
              ? { status: PrismaSessionStatus.OPEN, expiresAt: { gt: input.now } }
              : { status: { in: [PrismaSessionStatus.OPEN, PrismaSessionStatus.EXPIRED] } }),
          },
        },
        ...externalIdScope,
      },
      data: {
        status: input.status,
        ...externalIdData,
        ...(input.reconciliationReference === undefined
          ? {}
          : { reconciliationReference: normalizeReconciliationReference(input.reconciliationReference) }),
        unknownReason: input.unknownReason,
        ...(input.paymentInstructions
          ? { paymentInstructions: input.paymentInstructions }
          : {}),
        leaseUntil: null,
        leaseToken: null,
      },
    })
    if (result.count !== 1) {
      throw new PaymentProviderLeaseError(
        "STALE_FENCE",
        "A tentativa foi atualizada por outro worker",
      )
    }
    const attempt = await prisma.paymentProviderAttempt.findUniqueOrThrow({
      where: { id: input.attemptId },
      select: attemptSelect,
    })
    return toAttemptRecord(attempt)
  }

  async findAttemptByExternalId(input: {
    readonly externalId: string
    readonly provider: PaymentProviderAttemptRecord["provider"]
    readonly environment: PaymentProviderAttemptRecord["environment"]
    readonly externalAccountContext: string
  }): Promise<StoredPaymentProviderAttemptRecord | null> {
    const externalId = input.externalId.trim()
    if (!externalId) throw new Error("externalId é obrigatório")
    const attempt = await prisma.paymentProviderAttempt.findFirst({
      where: {
        externalId,
        providerKey: input.provider,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
      },
      select: attemptSelect,
    })
    return attempt ? toAttemptRecord(attempt) : null
  }

  async applyEventWithClaim(
    input: ApplyPaymentProviderEventInput,
  ): Promise<StoredPaymentProviderAttemptRecord> {
    if (!input.claimToken.trim()) throw new Error("Claim token é obrigatório")
    if (!input.externalId.trim()) throw new Error("externalId é obrigatório")
    const attemptId = input.attemptId?.trim()
    assertAttemptStatusTransition(input.expectedStatus, input.nextStatus)
    const result = await prisma.paymentProviderAttempt.updateMany({
      where: {
        ...(attemptId ? { id: attemptId } : { externalId: input.externalId }),
        providerKey: input.provider,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
        status: input.expectedStatus,
        OR: [
          { lastEventClaimToken: null },
          { NOT: { lastEventClaimToken: input.claimToken } },
        ],
        ...(attemptId
          ? { AND: [{ OR: [{ externalId: null }, { externalId: input.externalId }] }] }
          : {}),
      },
      data: {
        status: input.nextStatus,
        // A correlated event resolves an attempt that never learned its provider
        // id (indeterminate initiation); the verified webhook carries it.
        ...(attemptId ? { externalId: input.externalId } : {}),
        lastEventClaimToken: input.claimToken,
        leaseToken: null,
        leaseUntil: null,
      },
    })
    if (result.count !== 1) {
      throw new PaymentProviderLeaseError(
        "STALE_FENCE",
        "O claim do evento não corresponde ao estado atual da tentativa",
      )
    }
    const attempt = await prisma.paymentProviderAttempt.findFirstOrThrow({
      where: {
        ...(attemptId ? { id: attemptId } : { externalId: input.externalId }),
        providerKey: input.provider,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
      },
      select: attemptSelect,
    })
    return toAttemptRecord(attempt)
  }

  async findAttemptById(attemptId: string): Promise<StoredPaymentProviderAttemptRecord | null> {
    const attempt = await prisma.paymentProviderAttempt.findUnique({
      where: { id: attemptId },
      select: attemptSelect,
    })
    return attempt ? toAttemptRecord(attempt) : null
  }

  async findLatestAttemptByOwner(input: {
    readonly ownerType: string
    readonly ownerId: string
  }): Promise<StoredPaymentProviderAttemptRecord | null> {
    const where = { session: { is: { ownerType: input.ownerType, ownerId: input.ownerId } } }
    const confirmed = await prisma.paymentProviderAttempt.findFirst({
      where: { ...where, status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      select: attemptSelect,
    })
    if (confirmed) return toAttemptRecord(confirmed)
    const latest = await prisma.paymentProviderAttempt.findFirst({
      where,
      orderBy: { updatedAt: "desc" },
      select: attemptSelect,
    })
    return latest ? toAttemptRecord(latest) : null
  }

  async listAttempts(input: {
    readonly status: PaymentAttemptStatus
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    const attempts = await prisma.paymentProviderAttempt.findMany({
      where: { status: input.status },
      orderBy: { updatedAt: "asc" },
      take: input.limit,
      select: attemptSelect,
    })
    return attempts.map(toAttemptRecord)
  }

  async listAttemptsPendingReconciliation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    // Permanently ineligible attempts (non-purchase owners, purchases without a
    // mappable billing type) are excluded before the LIMIT so they cannot occupy
    // the maintenance batch forever. Attempts without a provider identifier are
    // still eligible while they carry the attempt-unique reference returned by
    // an indeterminate initiation: the reconciliation worker resolves the charge
    // by that reference. The bounded age window keeps lookups that can never
    // match (the provider never created a charge) from running forever.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT a."id"
      FROM "payment_provider_attempts" a
      INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
      INNER JOIN "corretor_studio_platform_purchases" p ON p."id"::text = s."owner_id"
      WHERE a."status" = 'UNKNOWN'::"payment_provider_attempt_status"
        AND s."owner_type" = 'PLATFORM_PURCHASE'
        AND p."billing_type" IN ('PIX', 'CREDIT_CARD')
        AND (
          a."external_id" IS NOT NULL
          OR (
            a."reconciliation_reference" IS NOT NULL
            AND a."updated_at" >= now() - interval '7 days'
          )
        )
      ORDER BY a."updated_at" ASC
      LIMIT ${input.limit}
    `
    return fetchAttemptsByIdsInOrder(rows)
  }

  async listAttemptsPendingPurchaseActivation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    // Repair path for the window between the fenced attempt transition and the
    // purchase activation projection. Only purchases that still accept payment
    // enter the batch, so terminal or already-paid purchases are never touched.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT a."id"
      FROM "payment_provider_attempts" a
      INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
      INNER JOIN "corretor_studio_platform_purchases" p ON p."id"::text = s."owner_id"
      WHERE a."status" = 'CONFIRMED'::"payment_provider_attempt_status"
        AND a."external_id" IS NOT NULL
        AND s."owner_type" = 'PLATFORM_PURCHASE'
        AND p."status" IN ('pending', 'awaiting_payment')
      ORDER BY a."updated_at" ASC
      LIMIT ${input.limit}
    `
    return fetchAttemptsByIdsInOrder(rows)
  }

  async listAttemptsPendingEmailCreditEntitlements(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    // Same reasoning as listAttemptsPendingReconciliation: only attempts whose
    // purchase actually needs email credits enter the batch, and attempts that
    // already granted credits are excluded before the LIMIT. The NOT EXISTS
    // mirrors the apply path's idempotency key — (paymentId, account) with the
    // maintenance loop always applying under the default "primary" account — so
    // granted attempts cannot starve pending ones.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT a."id"
      FROM "payment_provider_attempts" a
      INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
      INNER JOIN "corretor_studio_platform_purchases" p ON p."id"::text = s."owner_id"
      WHERE a."status" = 'CONFIRMED'::"payment_provider_attempt_status"
        AND a."external_id" IS NOT NULL
        AND s."owner_type" = 'PLATFORM_PURCHASE'
        AND p."purchase_type" = 'email_credits'::"platform_purchase_type"
        AND NOT EXISTS (
          SELECT 1
          FROM "corretor_studio_email_credit_payment_grants" g
          WHERE g."paymentId" = a."external_id"
            AND g."asaasAccount" = 'primary'
        )
      ORDER BY a."updated_at" ASC
      LIMIT ${input.limit}
    `
    return fetchAttemptsByIdsInOrder(rows)
  }

  async listOwnerAttemptsPendingSettlement(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    // Reparo da janela entre a transição fenceada da tentativa (CONFIRMED) e o efeito de
    // domínio do owner: o reenvio do webhook não repete o efeito porque a tentativa já está
    // CONFIRMED. O registro do owner só chega a "completed" depois do efeito, então ele é o
    // marcador do que falta. A janela de 30 dias evita repetir para sempre um caso sem saída.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT pending."id"
      FROM (
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "backoffice_adhesion_payments" p ON p."id"::text = s."owner_id"
        WHERE a."status" = 'CONFIRMED'::"payment_provider_attempt_status"
          AND a."external_id" IS NOT NULL
          AND s."owner_type" = 'BACKOFFICE_ADHESION'
          AND p."status" NOT IN ('completed', 'superseded', 'review')
          AND a."updated_at" >= now() - interval '30 days'
        UNION ALL
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "billing_grace_payments" g ON g."id"::text = s."owner_id"
        WHERE a."status" = 'CONFIRMED'::"payment_provider_attempt_status"
          AND a."external_id" IS NOT NULL
          AND s."owner_type" = 'BILLING_GRACE_PAYMENT'
          AND g."status" IN ('pending', 'confirmed')
          AND a."updated_at" >= now() - interval '30 days'
        UNION ALL
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "payment_charges" c ON c."id"::text = s."owner_id"
        WHERE a."status" = 'CONFIRMED'::"payment_provider_attempt_status"
          AND a."external_id" IS NOT NULL
          AND s."owner_type" = 'PAYMENT_CHARGE'
          AND c."status" IN ('PENDING', 'CONFIRMED')
          AND a."updated_at" >= now() - interval '30 days'
      ) pending
      ORDER BY pending."updated_at" ASC
      LIMIT ${input.limit}
    `
    return fetchAttemptsByIdsInOrder(rows)
  }

  async listOwnerAttemptsPendingReconciliation(input: {
    readonly limit: number
  }): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
    assertAttemptListLimit(input.limit)
    // Mesmos critérios de elegibilidade de listAttemptsPendingReconciliation: com id do
    // provider, ou com a referência única da tentativa dentro da janela de 7 dias.
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT unknown_attempts."id"
      FROM (
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "backoffice_adhesion_payments" p ON p."id"::text = s."owner_id"
        WHERE a."status" = 'UNKNOWN'::"payment_provider_attempt_status"
          AND s."owner_type" = 'BACKOFFICE_ADHESION'
          AND p."status" NOT IN ('completed', 'superseded', 'review')
          AND (
            a."external_id" IS NOT NULL
            OR (a."reconciliation_reference" IS NOT NULL AND a."updated_at" >= now() - interval '7 days')
          )
        UNION ALL
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "billing_grace_payments" g ON g."id"::text = s."owner_id"
        WHERE a."status" = 'UNKNOWN'::"payment_provider_attempt_status"
          AND s."owner_type" = 'BILLING_GRACE_PAYMENT'
          AND g."status" IN ('pending', 'confirmed')
          AND (
            a."external_id" IS NOT NULL
            OR (a."reconciliation_reference" IS NOT NULL AND a."updated_at" >= now() - interval '7 days')
          )
        UNION ALL
        SELECT a."id", a."updated_at"
        FROM "payment_provider_attempts" a
        INNER JOIN "payment_provider_sessions" s ON s."id" = a."session_id"
        INNER JOIN "payment_charges" c ON c."id"::text = s."owner_id"
        WHERE a."status" = 'UNKNOWN'::"payment_provider_attempt_status"
          AND s."owner_type" = 'PAYMENT_CHARGE'
          AND c."status" IN ('PENDING', 'CONFIRMED')
          AND (
            a."external_id" IS NOT NULL
            OR (a."reconciliation_reference" IS NOT NULL AND a."updated_at" >= now() - interval '7 days')
          )
      ) unknown_attempts
      ORDER BY unknown_attempts."updated_at" ASC
      LIMIT ${input.limit}
    `
    return fetchAttemptsByIdsInOrder(rows)
  }

  async releaseAttemptLease(input: {
    readonly attemptId: string
    readonly lease: ProviderLeaseState
    readonly now: Date
  }): Promise<void> {
    const result = await prisma.paymentProviderAttempt.updateMany({
      where: {
        id: input.attemptId,
        leaseToken: input.lease.leaseToken,
        fenceVersion: input.lease.fenceVersion,
        leaseUntil: { gt: input.now },
      },
      data: { leaseToken: null, leaseUntil: null },
    })
    if (result.count !== 1) {
      throw new PaymentProviderLeaseError(
        "STALE_FENCE",
        "A lease da tentativa não pode ser liberada com segurança",
      )
    }
  }
}

function validateLeaseTtl(ttlMs: number): void {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error("TTL da lease inválido")
}

function normalizeExternalId(externalId: string | null | undefined): string | undefined {
  if (externalId === null) throw new Error("externalId não pode ser apagado de uma tentativa")
  if (externalId === undefined) return undefined
  const normalized = externalId.trim()
  if (!normalized) throw new Error("externalId não pode ser vazio")
  return normalized
}

function normalizeReconciliationReference(
  reference: string | null | undefined,
): string | null | undefined {
  if (reference === undefined) return undefined
  if (reference === null) return null
  const normalized = reference.trim()
  if (!normalized) return null
  return normalized
}

function assertSessionBindingMatches(
  session: {
    providerKey: string
    environment: string
    externalAccountContext: string
    route: string
    routeVersion: string
  },
  input: CreatePaymentProviderSessionInput,
): void {
  const matches =
    session.providerKey === input.provider &&
    session.environment === input.environment &&
    session.externalAccountContext === input.externalAccountContext &&
    session.route === input.route &&
    session.routeVersion === input.routeVersion
  if (!matches) throw new Error("A sessão existente está vinculada a outro provider ou rota")
}

function toSessionRecord(record: {
  id: string
  tenantId: string
  ownerType: string
  ownerId: string
  idempotencyKey: string
  environment: string
  providerKey: string
  externalAccountContext: string
  route: string
  routeVersion: string
  status: string
  leaseToken: string | null
  leaseUntil: Date | null
  fenceVersion: number
  expiresAt: Date
}): PaymentProviderSessionRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    idempotencyKey: record.idempotencyKey,
    environment: record.environment as PaymentProviderSessionRecord["environment"],
    provider: record.providerKey as PaymentProviderSessionRecord["provider"],
    externalAccountContext: record.externalAccountContext,
    route: record.route as PaymentProviderSessionRecord["route"],
    routeVersion: record.routeVersion,
    expiresAt: record.expiresAt,
    status: record.status as PaymentProviderSessionRecord["status"],
    lease: toLease(record),
  }
}

function toAttemptRecord(record: {
  id: string
  sessionId: string
  attemptNumber: number
  idempotencyKey: string
  requestFingerprint: string
  providerKey: string
  environment: string
  externalAccountContext: string
  status: string
  externalId: string | null
  reconciliationReference: string | null
  leaseToken: string | null
  leaseUntil: Date | null
  fenceVersion: number
  unknownReason: string | null
  paymentInstructions: Prisma.JsonValue
  session: {
    tenantId: string
    ownerType: string
    ownerId: string
  }
}): StoredPaymentProviderAttemptRecord {
  return {
    id: record.id,
    sessionId: record.sessionId,
    attemptNumber: record.attemptNumber,
    idempotencyKey: record.idempotencyKey,
    requestFingerprint: record.requestFingerprint,
    provider: record.providerKey as PaymentProviderAttemptRecord["provider"],
    environment: record.environment as PaymentProviderAttemptRecord["environment"],
    externalAccountContext: record.externalAccountContext,
    tenantId: record.session.tenantId,
    ownerType: record.session.ownerType,
    ownerId: record.session.ownerId,
    status: record.status as PaymentAttemptStatus,
    externalId: record.externalId,
    reconciliationReference: record.reconciliationReference,
    unknownReason: record.unknownReason,
    paymentInstructions: toProviderPixInstructions(record.paymentInstructions),
    lease: toLease(record),
  }
}

function toProviderPixInstructions(value: Prisma.JsonValue): ProviderPixInstructions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.brCode !== "string" ||
    typeof candidate.brCodeBase64 !== "string" ||
    typeof candidate.expiresAt !== "string"
  ) {
    return null
  }
  return {
    brCode: candidate.brCode,
    brCodeBase64: candidate.brCodeBase64,
    expiresAt: candidate.expiresAt,
  }
}

function assertAttemptListLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Limite de tentativas inválido")
  }
}

async function fetchAttemptsByIdsInOrder(
  rows: readonly { id: string }[],
): Promise<readonly StoredPaymentProviderAttemptRecord[]> {
  if (rows.length === 0) return []
  const attempts = await prisma.paymentProviderAttempt.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: attemptSelect,
  })
  const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]))
  return rows
    .map((row) => attemptsById.get(row.id))
    .filter((attempt): attempt is (typeof attempts)[number] => attempt !== undefined)
    .map(toAttemptRecord)
}

function hashRequestFingerprint(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error("Fingerprint da requisição é obrigatório")
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}

function assertAttemptBindingMatches(
  attempt: {
    sessionId: string
    attemptNumber: number
    idempotencyKey: string
    requestFingerprint: string
    providerKey: string
    environment: string
    externalAccountContext: string
  },
  input: CreatePaymentProviderAttemptInput,
  requestFingerprint: string,
): void {
  const matches =
    attempt.sessionId === input.sessionId &&
    attempt.idempotencyKey === input.idempotencyKey &&
    attempt.requestFingerprint === requestFingerprint &&
    attempt.providerKey === input.provider &&
    attempt.environment === input.environment &&
    attempt.externalAccountContext === input.externalAccountContext
  if (!matches) throw new Error("A idempotência da tentativa diverge da requisição")
}

function toLease(record: {
  leaseToken: string | null
  leaseUntil: Date | null
  fenceVersion: number
}): ProviderLeaseState {
  return {
    leaseToken: record.leaseToken,
    leaseUntil: record.leaseUntil,
    fenceVersion: record.fenceVersion,
  }
}

export const paymentProviderSessionRepository = new PaymentProviderSessionRepository()
