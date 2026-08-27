import { describe, expect, it } from "bun:test"
import {
  RESEND_MONTHLY_QUOTA_TAG,
  buildResendQuotaIncidentLog,
  isMonthlyQuotaIncidentActive,
  startOfMonthUtc,
} from "./resend-quota-incident"

describe("resend-quota-incident", () => {
  it("a tag é estável — é o que o alerta do drain casa", () => {
    expect(RESEND_MONTHLY_QUOTA_TAG).toBe("resend_monthly_quota_exceeded")
  })

  it("o log carrega a superfície: alerta sem ela não diz o que morreu", () => {
    const log = buildResendQuotaIncidentLog({
      surface: "transactional",
      category: "forgot-password",
    })

    expect(log.tag).toBe(RESEND_MONTHLY_QUOTA_TAG)
    expect(log.surface).toBe("transactional")
    expect(log.category).toBe("forgot-password")
  })

  it("incidente do mês corrente está ativo; do mês anterior, não", () => {
    const agora = new Date("2026-08-25T12:00:00.000Z")

    expect(isMonthlyQuotaIncidentActive(new Date("2026-08-01T00:00:00.000Z"), agora)).toBe(true)
    expect(isMonthlyQuotaIncidentActive(new Date("2026-08-25T11:59:00.000Z"), agora)).toBe(true)
    expect(isMonthlyQuotaIncidentActive(new Date("2026-07-31T23:59:59.999Z"), agora)).toBe(false)
    expect(isMonthlyQuotaIncidentActive(null, agora)).toBe(false)
  })

  it("a virada do mês libera o disparo sem intervenção manual", () => {
    const incidente = new Date("2026-07-20T10:00:00.000Z")

    expect(isMonthlyQuotaIncidentActive(incidente, new Date("2026-07-31T23:00:00.000Z"))).toBe(true)
    expect(isMonthlyQuotaIncidentActive(incidente, new Date("2026-08-01T00:00:00.000Z"))).toBe(false)
  })

  it("startOfMonthUtc ancora no primeiro instante do mês", () => {
    expect(startOfMonthUtc(new Date("2026-08-25T12:34:56.789Z")).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z"
    )
  })
})
