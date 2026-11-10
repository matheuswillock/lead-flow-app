import type { CouponDiscountRule } from "./coupon-discount"

export type ValidatedBackofficeCoupon = {
  id: string
  code: string
  rule: CouponDiscountRule
}

export interface IBackofficeCouponService {
  /** Valida o cupom; lança `SelfCheckoutError("COUPON_INVALID")` com mensagem curta em português. */
  validate(rawCode: string, now?: Date): Promise<ValidatedBackofficeCoupon>
  /** Reserva um uso atomicamente; lança `COUPON_INVALID` se esgotou ou perdeu a validade. */
  reserve(coupon: ValidatedBackofficeCoupon, now?: Date): Promise<void>
  release(coupon: ValidatedBackofficeCoupon): Promise<void>
}
