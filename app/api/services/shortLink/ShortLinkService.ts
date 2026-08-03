import { shortLinkRepository } from "@/app/api/infra/data/repositories/shortLink/ShortLinkRepository"
import { generateShortCode } from "@/lib/short-link"
import { getFullUrl } from "@/lib/utils/app-url"
import type { IShortLinkService } from "./IShortLinkService"

const MAX_RETRIES = 3

export class ShortLinkService implements IShortLinkService {
  async getOrCreate(input: { targetUrl: string; expiresAt?: Date }): Promise<string> {
    const existing = await shortLinkRepository.findByTargetUrl(input.targetUrl)

    if (existing) {
      const isExpired = existing.expiresAt && existing.expiresAt <= new Date()
      if (!isExpired) {
        return getFullUrl(`/s/${existing.code}`)
      }
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = generateShortCode()
      try {
        await shortLinkRepository.create({
          code,
          targetUrl: input.targetUrl,
          expiresAt: input.expiresAt,
        })
        return getFullUrl(`/s/${code}`)
      } catch (error: unknown) {
        const prismaError = error as { code?: string }
        if (prismaError?.code === "P2002") {
          continue
        }
        throw error
      }
    }

    throw new Error("[ShortLinkService] Falha ao gerar código único após várias tentativas.")
  }
}

export const shortLinkService = new ShortLinkService()
