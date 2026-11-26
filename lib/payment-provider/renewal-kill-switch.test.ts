import { describe, expect, it } from "bun:test"
import { isProviderRenewalEnabled, PROVIDER_RENEWAL_ENABLED_ENV } from "./renewal-kill-switch"

describe("isProviderRenewalEnabled", () => {
  it("fica desligado quando a variável está ausente", () => {
    expect(isProviderRenewalEnabled({})).toBe(false)
  })

  it("só liga com o valor literal true, sem diferenciar maiúsculas", () => {
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "true" })).toBe(true)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: " TRUE " })).toBe(true)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "1" })).toBe(false)
    expect(isProviderRenewalEnabled({ [PROVIDER_RENEWAL_ENABLED_ENV]: "" })).toBe(false)
  })
})
