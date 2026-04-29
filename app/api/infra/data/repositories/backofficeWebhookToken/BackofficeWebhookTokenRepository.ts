import type { BackofficeWebhookSource, BackofficeWebhookToken } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeWebhookTokenRepository,
  ListBackofficeWebhookTokensParams,
  RotateBackofficeWebhookTokenInput,
} from "./IBackofficeWebhookTokenRepository"

const DEFAULT_LIMIT = 15
const MAX_LIMIT = 100

export class BackofficeWebhookTokenRepository
  implements IBackofficeWebhookTokenRepository
{
  async findActiveBySource(
    source: BackofficeWebhookSource
  ): Promise<BackofficeWebhookToken | null> {
    return prisma.backofficeWebhookToken.findFirst({
      where: { source, status: "active" },
      orderBy: { generatedAt: "desc" },
    })
  }

  async findMany(
    params?: ListBackofficeWebhookTokensParams
  ): Promise<BackofficeWebhookToken[]> {
    const limit = Math.max(1, Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT))

    return prisma.backofficeWebhookToken.findMany({
      where: { source: params?.source },
      orderBy: { generatedAt: "desc" },
      take: limit,
    })
  }

  async rotateActiveToken(
    input: RotateBackofficeWebhookTokenInput
  ): Promise<BackofficeWebhookToken> {
    return prisma.$transaction(async (tx) => {
      await tx.backofficeWebhookToken.updateMany({
        where: { source: input.source, status: "active" },
        data: { status: "replaced" },
      })

      return tx.backofficeWebhookToken.create({
        data: {
          source: input.source,
          tokenHash: input.tokenHash,
          tokenCipher: input.tokenCipher,
          tokenPreview: input.tokenPreview,
          status: "active",
          expiryMode: input.expiryMode,
          expiresAt: input.expiresAt,
          generatedByBackofficeUserId: input.generatedByBackofficeUserId,
          generatedByEmailSnapshot: input.generatedByEmailSnapshot,
        },
      })
    })
  }

  async markExpired(id: string): Promise<void> {
    await prisma.backofficeWebhookToken.updateMany({
      where: { id, status: "active" },
      data: { status: "expired" },
    })
  }

  async touchLastUsed(id: string): Promise<void> {
    await prisma.backofficeWebhookToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  }
}
