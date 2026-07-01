import { describe, expect, it } from "bun:test"
import { formatResendRegion, RESEND_REGION_LABELS } from "./resend-region-labels"

describe("formatResendRegion", () => {
  it("retorna label amigável para regiões conhecidas", () => {
    expect(formatResendRegion("sa-east-1")).toBe(RESEND_REGION_LABELS["sa-east-1"])
    expect(formatResendRegion("us-east-1")).toBe(RESEND_REGION_LABELS["us-east-1"])
  })

  it("retorna fallback para região desconhecida", () => {
    expect(formatResendRegion("custom-region")).toBe("custom-region")
  })

  it("retorna não informada quando vazio", () => {
    expect(formatResendRegion(null)).toBe("Não informada")
    expect(formatResendRegion(undefined)).toBe("Não informada")
  })
})
