import { prisma } from "@/app/api/infra/data/prisma"
import type { BackofficeCouponRecord, IBackofficeCouponRepository } from "./IBackofficeCouponRepository"

export class BackofficeCouponRepository implements IBackofficeCouponRepository {
  async findByCode(code: string): Promise<BackofficeCouponRecord | null> {
    const coupon = await prisma.backofficeCoupon.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        maxUses: true,
        usesCount: true,
      },
    })
    if (!coupon) return null
    return { ...coupon, discountValue: Number(coupon.discountValue.toString()) }
  }

  async reserveUse(id: string, now: Date): Promise<boolean> {
    const updated = await prisma.$executeRaw`
      UPDATE "backoffice_coupons"
      SET "usesCount" = "usesCount" + 1, "updatedAt" = now()
      WHERE "id" = ${id}::uuid
        AND "isActive" = true
        AND ("validFrom" IS NULL OR "validFrom" <= ${now})
        AND ("validUntil" IS NULL OR "validUntil" >= ${now})
        AND ("maxUses" IS NULL OR "usesCount" < "maxUses")
    `
    return updated === 1
  }

  async releaseUse(id: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "backoffice_coupons"
      SET "usesCount" = GREATEST("usesCount" - 1, 0), "updatedAt" = now()
      WHERE "id" = ${id}::uuid
    `
  }
}
