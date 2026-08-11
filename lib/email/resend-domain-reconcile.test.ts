import { describe, expect, it } from "bun:test"
import {
  isResendDomainSnapshotInSync,
  isResendDomainStatusInSync,
} from "./resend-domain-reconcile"

describe("isResendDomainStatusInSync", () => {
  it("considera sincronizado quando status é igual", () => {
    expect(isResendDomainStatusInSync("verified", "verified")).toBe(true)
    expect(isResendDomainStatusInSync("partially_failed", "partially_failed")).toBe(true)
  })

  it("detecta dessincronia", () => {
    expect(isResendDomainStatusInSync("verified", "partially_failed")).toBe(false)
    expect(isResendDomainStatusInSync("partially_failed", "verified")).toBe(false)
  })

  it("trata null/undefined como equivalentes", () => {
    expect(isResendDomainStatusInSync(null, undefined)).toBe(true)
    expect(isResendDomainStatusInSync(null, "pending")).toBe(false)
  })
})

describe("isResendDomainSnapshotInSync", () => {
  const basePersisted = {
    resendDomainStatus: "verified",
    resendDomainRegion: "sa-east-1",
    resendOpenTracking: true,
    resendClickTracking: false,
  }

  it("considera sincronizado quando status, região e tracking batem", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: false,
      })
    ).toBe(true)
  })

  it("aceita snake_case do Resend para tracking", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        open_tracking: true,
        click_tracking: false,
      })
    ).toBe(true)
  })

  it("detecta dessincronia de open_tracking com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: false,
        clickTracking: false,
      })
    ).toBe(false)
  })

  it("detecta dessincronia de click_tracking com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: true,
      })
    ).toBe(false)
  })

  it("detecta dessincronia de region com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "us-east-1",
        openTracking: true,
        clickTracking: false,
      })
    ).toBe(false)
  })

  it("normaliza region ausente como null e tracking ausente como false", () => {
    expect(
      isResendDomainSnapshotInSync(
        {
          resendDomainStatus: "verified",
          resendDomainRegion: null,
          resendOpenTracking: false,
          resendClickTracking: false,
        },
        { status: "verified" }
      )
    ).toBe(true)
  })
})
