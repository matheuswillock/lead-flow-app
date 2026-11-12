import { SelfCheckoutError } from "@/lib/self-checkout/contracts"
import { normalizeCouponCode } from "@/lib/self-checkout/coupon-discount"
import type { IBackofficeCouponRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCoupon/IBackofficeCouponRepository"
import { BackofficeCouponRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCoupon/BackofficeCouponRepository"
import type { IBackofficeCouponService, ValidatedBackofficeCoupon } from "./coupon-service-types"

export const COUPON_INVALID_MESSAGE = "Cupom inválido."
export const COUPON_EXPIRED_MESSAGE = "Cupom expirado."
export const COUPON_EXHAUSTED_MESSAGE = "Cupom esgotado."

function invalid(message: string): SelfCheckoutError {
  return new SelfCheckoutError("COUPON_INVALID", message)
}

/**
 * DESLIGADO DE PROPÓSITO: por enquanto não há cupons. Com `false`, `validate` recusa qualquer código como
 * "Cupom expirado." SEM consultar o banco. Para religar, troque para `true` (ou injete `validationEnabled`).
 */
const COUPON_VALIDATION_ENABLED = false as boolean

export class BackofficeCouponService implements IBackofficeCouponService {
  constructor(
    private readonly repo: IBackofficeCouponRepository = new BackofficeCouponRepository(),
    private readonly options: { validationEnabled?: boolean } = {}
  ) {}

  /** Único ponto de validação de cupom (endpoint `/coupon` e criação do pedido passam por aqui). */
  async validate(rawCode: string, now: Date = new Date()): Promise<ValidatedBackofficeCoupon> {
    if (!(this.options.validationEnabled ?? COUPON_VALIDATION_ENABLED)) {
      throw invalid(COUPON_EXPIRED_MESSAGE)
    }
    const code = normalizeCouponCode(rawCode)
    const coupon = code ? await this.repo.findByCode(code) : null
    // Inexistente e inativo respondem igual: não revelam se o código existe.
    if (!coupon || !coupon.isActive) throw invalid(COUPON_INVALID_MESSAGE)
    if (coupon.validFrom && coupon.validFrom > now) throw invalid(COUPON_INVALID_MESSAGE)
    if (coupon.validUntil && coupon.validUntil < now) throw invalid(COUPON_EXPIRED_MESSAGE)
    if (coupon.maxUses != null && coupon.usesCount >= coupon.maxUses) throw invalid(COUPON_EXHAUSTED_MESSAGE)
    return {
      id: coupon.id,
      code: coupon.code,
      rule: { type: coupon.discountType, value: coupon.discountValue },
    }
  }

  async reserve(coupon: ValidatedBackofficeCoupon, now: Date = new Date()): Promise<void> {
    const reserved = await this.repo.reserveUse(coupon.id, now)
    if (!reserved) throw invalid(COUPON_EXHAUSTED_MESSAGE)
  }

  async release(coupon: ValidatedBackofficeCoupon): Promise<void> {
    await this.repo.releaseUse(coupon.id)
  }
}
