import type { BackofficeCouponDiscountType } from "@prisma/client"

export type BackofficeCouponRecord = {
  id: string
  code: string
  discountType: BackofficeCouponDiscountType
  discountValue: number
  isActive: boolean
  validFrom: Date | null
  validUntil: Date | null
  maxUses: number | null
  usesCount: number
}

export interface IBackofficeCouponRepository {
  findByCode(code: string): Promise<BackofficeCouponRecord | null>
  /**
   * Reserva um uso de forma atômica (UPDATE condicional): só incrementa se o cupom continua
   * ativo, dentro da validade e com saldo de usos. Devolve false quando a reserva não foi possível.
   */
  reserveUse(id: string, now: Date): Promise<boolean>
  /** Devolve um uso reservado (falha ao criar o pedido). Nunca deixa o contador negativo. */
  releaseUse(id: string): Promise<void>
}
