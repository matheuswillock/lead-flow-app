import { backofficeShortLinkRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeShortLink/BackofficeShortLinkRepository"
import { generateShortCode } from "@/lib/short-link"
import { getFullUrl } from "@/lib/utils/app-url"

const MAX_RETRIES = 3

export class BackofficeShortLinkService {
  async getOrCreate(input: { targetUrl: string; expiresAt?: Date }): Promise<string> {
    const existing = await backofficeShortLinkRepository.findByTargetUrl(input.targetUrl)

    if (existing) {
      const isExpired = existing.expiresAt && existing.expiresAt <= new Date()
      if (!isExpired) {
        return getFullUrl(`/s/${existing.code}`)
      }
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = generateShortCode()
      try {
        await backofficeShortLinkRepository.create({
          code,
          targetUrl: input.targetUrl,
          expiresAt: input.expiresAt ?? null,
        })
        return getFullUrl(`/s/${code}`)
      } catch (error: unknown) {
        const prismaError = error as { code?: string; meta?: { target?: string | string[] } }
        if (prismaError?.code === "P2002") {
          const target = prismaError?.meta?.target
          const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : []
          const isTargetUrlConflict = targets.some((t) => t.toLowerCase().includes("target"))
          if (isTargetUrlConflict) {
            const raced = await backofficeShortLinkRepository.findByTargetUrlAfterRace(input.targetUrl)
            if (raced && !(raced.expiresAt && raced.expiresAt <= new Date())) {
              return getFullUrl(`/s/${raced.code}`)
            }
          }
          continue
        }
        throw error
      }
    }

    throw new Error("[BackofficeShortLinkService] Falha ao gerar código único após várias tentativas.")
  }
}

export const backofficeShortLinkService = new BackofficeShortLinkService()
