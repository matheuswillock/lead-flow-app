import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"
import type {
  ClaimCardProcessingInput,
  CompleteCardAttemptInput,
  IAsaasCardReauthorizationRepository,
} from "./IAsaasCardReauthorizationRepository"

const DECLINE_LIMIT = 5
const DECLINE_WINDOW_MS = 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export class AsaasCardReauthorizationRepository implements IAsaasCardReauthorizationRepository {
  async createToken(migrationId: string, expiresAt: Date): Promise<string> {
    const token = randomBytes(32).toString("base64url")
    await prisma.asaasCardReauthorization.upsert({
      where: { migrationId },
      create: { migrationId, tokenHash: hashToken(token), expiresAt },
      update: { tokenHash: hashToken(token), expiresAt, usedAt: null, attemptCount: 0, lastError: null },
    })
    return token
  }

  async findRecoveryMigrationForAuthenticatedMaster(supabaseId: string) {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, isMaster: true, deletedAt: true, subscription: { select: { subscriptionStatus: true, subscriptionNextDueDate: true } } },
    })
    if (!profile || !profile.isMaster || profile.deletedAt) return null

    const migration = await prisma.asaasAccountMigration.findFirst({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, primaryCustomerId: true, status: true, quoteSnapshot: true },
    })
    if (!migration) return null

    return { ...migration, isBanned: await isAccountMasterBanned(profile.id), isPaymentPaused: profile.subscription?.subscriptionStatus === "past_due" || Boolean(profile.subscription?.subscriptionNextDueDate && profile.subscription.subscriptionNextDueDate < new Date()) }
  }

  async findForMaster(token: string, supabaseId: string) {
    const record = await prisma.asaasCardReauthorization.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        migration: {
          select: {
            id: true,
            profileId: true,
            legacyCustomerId: true,
            clientName: true,
            clientEmail: true,
            quoteSnapshot: true,
            status: true,
            primaryCustomerId: true,
          },
        },
      },
    })
    if (!record) return null
    const profile = await prisma.profile.findUnique({
      where: { id: record.migration.profileId },
      select: { supabaseId: true, isMaster: true, deletedAt: true, subscription: { select: { subscriptionStatus: true, subscriptionNextDueDate: true } } },
    })
    if (!profile || profile.supabaseId !== supabaseId || !profile.isMaster || profile.deletedAt) return null
    const isPaymentPaused = profile.subscription?.subscriptionStatus === "past_due" || Boolean(profile.subscription?.subscriptionNextDueDate && profile.subscription.subscriptionNextDueDate < new Date())
    if (record.migration.status !== "paused_awaiting_card" || !record.migration.primaryCustomerId || !record.migration.quoteSnapshot || !isPaymentPaused) return null
    const isBanned = await isAccountMasterBanned(record.migration.profileId)
    return { ...record, isBanned, migration: { ...record.migration, profile } }
  }

  async markUsed(id: string): Promise<void> {
    await prisma.asaasCardReauthorization.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date(), processingOwner: null, processingExpiresAt: null },
    })
  }

  async claimForProcessing(input: ClaimCardProcessingInput) {
    return prisma.$transaction(async (transaction) => {
      const reauthorization = await transaction.asaasCardReauthorization.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          migration: { select: { profileId: true } },
        },
      })
      if (
        !reauthorization ||
        reauthorization.usedAt ||
        reauthorization.expiresAt <= input.now ||
        reauthorization.migration.profileId !== input.masterProfileId
      ) {
        return { kind: "invalid_or_expired" } as const
      }

      const declineWindowStart = new Date(input.now.getTime() - DECLINE_WINDOW_MS)
      const declineCount = await transaction.asaasCardReauthorizationAttempt.count({
        where: {
          reauthorizationId: input.id,
          status: "declined",
          createdAt: { gte: declineWindowStart },
        },
      })
      if (declineCount >= DECLINE_LIMIT) {
        const oldestDecline = await transaction.asaasCardReauthorizationAttempt.findFirst({
          where: {
            reauthorizationId: input.id,
            status: "declined",
            createdAt: { gte: declineWindowStart },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
        return {
          kind: "rate_limited",
          retryAt: new Date((oldestDecline?.createdAt ?? input.now).getTime() + DECLINE_WINDOW_MS),
        } as const
      }

      const claimed = await transaction.asaasCardReauthorization.updateMany({
        where: {
          id: input.id,
          usedAt: null,
          expiresAt: { gt: input.now },
          OR: [
            { processingOwner: null },
            { processingExpiresAt: null },
            { processingExpiresAt: { lt: input.now } },
          ],
        },
        data: {
          processingOwner: input.processingOwner,
          processingExpiresAt: new Date(input.now.getTime() + input.leaseDurationMs),
          lastAttemptAt: input.now,
        },
      })
      if (claimed.count === 0) return { kind: "already_processing" } as const

      const attemptId = randomUUID()
      const attemptReference = `asaas-card-attempt:${attemptId}`
      await transaction.asaasCardReauthorizationAttempt.create({
        data: {
          id: attemptId,
          reauthorizationId: input.id,
          masterProfileId: input.masterProfileId,
          attemptReference,
          status: "processing",
        },
      })
      return { kind: "claimed", attemptId, attemptReference } as const
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  async releaseProcessing(id: string, processingOwner: string): Promise<boolean> {
    const updated = await prisma.asaasCardReauthorization.updateMany({
      where: { id, processingOwner },
      data: { processingOwner: null, processingExpiresAt: null },
    })
    return updated.count > 0
  }

  async completeAttempt(input: CompleteCardAttemptInput): Promise<boolean> {
    const updated = await prisma.asaasCardReauthorizationAttempt.updateMany({
      where: { id: input.attemptId, status: "processing" },
      data: {
        status: input.status,
        failureCode: input.failureCode?.slice(0, 120) ?? null,
        completedAt: input.completedAt,
      },
    })
    return updated.count > 0
  }
}

export const asaasCardReauthorizationRepository = new AsaasCardReauthorizationRepository()
