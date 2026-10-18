import { createHash, randomUUID } from "node:crypto"
import { PaymentProviderSessionStatus as PrismaSessionStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  assertAttemptStatusTransition,
  PaymentProviderLeaseError,
  type ProviderLeaseState,
} from "@/lib/payment-provider/session"
import type { PaymentAttemptStatus } from "@/lib/payment-provider/types"
import type {
  AcquirePaymentProviderAttemptLeaseInput,
  CreatePaymentProviderAttemptInput,
  CreatePaymentProviderSessionInput,
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
  leaseToken: true,
  leaseUntil: true,
  fenceVersion: true,
  unknownReason: true,
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
    const attempt = await prisma.$transaction(async (transaction) => {
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
      const unresolvedAttempt = await transaction.paymentProviderAttempt.findFirst({
        where: { sessionId: input.sessionId, status: "UNKNOWN" },
        select: { id: true },
      })
      if (unresolvedAttempt) {
        throw new Error("A sessão possui tentativa UNKNOWN pendente de reconciliação")
      }
      return transaction.paymentProviderAttempt.create({
        data: {
          sessionId: input.sessionId,
          attemptNumber: input.attemptNumber,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: hashRequestFingerprint(input.requestFingerprint),
          providerKey: input.provider,
          environment: input.environment,
          externalAccountContext: input.externalAccountContext,
        },
        select: attemptSelect,
      })
    })
    return toAttemptRecord(attempt)
  }

  async acquireAttemptLease(
    input: AcquirePaymentProviderAttemptLeaseInput,
  ): Promise<StoredPaymentProviderAttemptRecord> {
    validateLeaseTtl(input.ttlMs)
    const leaseToken = randomUUID()
    const leaseUntil = new Date(input.now.getTime() + input.ttlMs)
    return prisma.$transaction(async (transaction) => {
      const sessionLifecycle =
        input.purpose === "RECONCILIATION"
          ? { status: { in: [PrismaSessionStatus.OPEN, PrismaSessionStatus.EXPIRED] } }
          : { status: PrismaSessionStatus.OPEN, expiresAt: { gt: input.now } }
      const result = await transaction.paymentProviderAttempt.updateMany({
        where: {
          id: input.attemptId,
          status:
            input.purpose === "RECONCILIATION"
              ? { in: ["UNKNOWN"] }
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
    if (["CONFIRMED", "REFUNDED", "DISPUTED"].includes(input.status) && !input.externalId?.trim()) {
      throw new Error("Estado de pagamento exige id externo")
    }
    if (input.externalId === null) {
      throw new Error("externalId não pode ser apagado de uma tentativa")
    }
    const externalIdScope = input.externalId
      ? { OR: [{ externalId: null }, { externalId: input.externalId }] }
      : {}
    const externalIdData = input.externalId === undefined ? {} : { externalId: input.externalId }
    const result = await prisma.paymentProviderAttempt.updateMany({
      // Reconciliation may finish an UNKNOWN attempt after checkout expiry;
      // payment operations remain restricted to live sessions.
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
            ...(input.operation === "RECONCILIATION"
              ? { status: { in: [PrismaSessionStatus.OPEN, PrismaSessionStatus.EXPIRED] } }
              : { status: PrismaSessionStatus.OPEN, expiresAt: { gt: input.now } }),
          },
        },
        ...externalIdScope,
      },
      data: {
        status: input.status,
        ...externalIdData,
        unknownReason: input.unknownReason,
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
}

function validateLeaseTtl(ttlMs: number): void {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error("TTL da lease inválido")
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
  leaseToken: string | null
  leaseUntil: Date | null
  fenceVersion: number
  unknownReason: string | null
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
    unknownReason: record.unknownReason,
    lease: toLease(record),
  }
}

function hashRequestFingerprint(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error("Fingerprint da requisição é obrigatório")
  return createHash("sha256").update(normalized, "utf8").digest("hex")
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
