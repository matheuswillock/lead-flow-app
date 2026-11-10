import { describe, expect, it } from "bun:test"
import {
  applyCouponDiscount,
  computeCouponDiscountAmount,
  describeCouponDiscount,
  normalizeCouponCode,
} from "./coupon-discount"

describe("coupon-discount", () => {
  it("normaliza o código em maiúsculas sem espaços nas pontas", () => {
    expect(normalizeCouponCode("  bemvindo10 ")).toBe("BEMVINDO10")
  })

  it("percentual e valor fixo arredondam em centavos", () => {
    expect(computeCouponDiscountAmount({ type: "percent", value: 10 }, 269.7)).toBe(26.97)
    expect(computeCouponDiscountAmount({ type: "fixed", value: 20 }, 100)).toBe(20)
    expect(applyCouponDiscount({ type: "percent", value: 33.33 }, 100)).toBe(66.67)
  })

  it("sempre deixa ao menos R$ 5,00 a cobrar e não desconta de totais pequenos", () => {
    expect(applyCouponDiscount({ type: "fixed", value: 500 }, 100)).toBe(5)
    expect(computeCouponDiscountAmount({ type: "fixed", value: 1 }, 5)).toBe(0)
  })

  it("sem regra devolve o total", () => {
    expect(applyCouponDiscount(null, 99.9)).toBe(99.9)
  })

  it("descreve o desconto para o cliente", () => {
    expect(describeCouponDiscount({ type: "percent", value: 10 })).toBe("10% de desconto")
    expect(describeCouponDiscount({ type: "percent", value: 12.5 })).toBe("12,50% de desconto")
    expect(describeCouponDiscount({ type: "fixed", value: 20 })).toContain("20,00")
  })
})
