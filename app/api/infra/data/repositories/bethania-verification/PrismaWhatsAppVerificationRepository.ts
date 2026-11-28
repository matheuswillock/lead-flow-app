import { prisma } from "@/app/api/infra/data/prisma"
import { canRequestWhatsAppCode } from "@/lib/bethania/verification-policy"
import type {
  IssueWhatsAppChallengeInput,
  WhatsAppVerificationChallenge,
  WhatsAppVerificationRepository,
} from "@/app/api/useCases/bethania-verification/WhatsAppVerificationRepository"

export class PrismaWhatsAppVerificationRepository implements WhatsAppVerificationRepository {
  async issueChallenge(input: IssueWhatsAppChallengeInput) {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { supabaseId: input.supabaseId },
        select: { id: true },
      })
      if (!profile) return null

      // Serialize same-profile issuance so concurrent requests cannot exceed the cap.
      await tx.$queryRaw`SELECT id FROM corretor_studio_profiles WHERE id = ${profile.id}::uuid FOR UPDATE`
      const recent = await tx.bethaniaVerificationChallenge.findMany({
        where: {
          profileId: profile.id,
          createdAt: { gt: new Date(input.createdAt.getTime() - 60 * 60_000), lte: input.createdAt },
        },
        select: { createdAt: true },
      })
      if (!canRequestWhatsAppCode(recent.map((item) => item.createdAt), input.createdAt)) return null

      return tx.bethaniaVerificationChallenge.create({
        data: {
          id: input.id,
          profileId: profile.id,
          phone: input.phone,
          codeHash: input.codeHash,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        },
        select: { id: true, profileId: true, phone: true },
      })
    })
  }

  async invalidateChallenge(id: string, now: Date): Promise<void> {
    await prisma.bethaniaVerificationChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: now },
    })
  }

  async findChallenge(supabaseId: string, id: string): Promise<WhatsAppVerificationChallenge | null> {
    const profile = await prisma.profile.findUnique({ where: { supabaseId }, select: { id: true } })
    if (!profile) return null
    return prisma.bethaniaVerificationChallenge.findFirst({
      where: { id, profileId: profile.id },
      select: {
        id: true,
        profileId: true,
        phone: true,
        codeHash: true,
        expiresAt: true,
        attempts: true,
        consumedAt: true,
        createdAt: true,
      },
    })
  }

  async incrementFailedAttempt(input: {
    supabaseId: string
    id: string
    maxAttempts: number
    now: Date
  }): Promise<void> {
    const profile = await prisma.profile.findUnique({ where: { supabaseId: input.supabaseId }, select: { id: true } })
    if (!profile) return
    await prisma.bethaniaVerificationChallenge.updateMany({
      where: {
        id: input.id,
        profileId: profile.id,
        consumedAt: null,
        attempts: { lt: input.maxAttempts },
        expiresAt: { gt: input.now },
      },
      data: { attempts: { increment: 1 } },
    })
  }

  async consumeAndSetPhone(input: {
    supabaseId: string
    id: string
    phone: string
    maxAttempts: number
    now: Date
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { supabaseId: input.supabaseId }, select: { id: true } })
      if (!profile) return false
      const consumed = await tx.bethaniaVerificationChallenge.updateMany({
        where: {
          id: input.id,
          profileId: profile.id,
          phone: input.phone,
          consumedAt: null,
          attempts: { lt: input.maxAttempts },
          expiresAt: { gt: input.now },
        },
        data: { consumedAt: input.now },
      })
      if (consumed.count !== 1) return false
      const updated = await tx.profile.updateMany({
        where: { id: profile.id },
        data: { whatsappPhone: input.phone, whatsappPhoneVerifiedAt: input.now },
      })
      if (updated.count !== 1) throw new Error("Profile disappeared")
      return true
    })
  }
}

export const whatsappVerificationRepository = new PrismaWhatsAppVerificationRepository()