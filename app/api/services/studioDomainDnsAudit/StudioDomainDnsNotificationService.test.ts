import { describe, expect, it } from "bun:test"
import { StudioDomainDnsNotificationService } from "./StudioDomainDnsNotificationService"

describe("StudioDomainDnsNotificationService basic", () => {
  it("service can be instantiated", () => {
    const service = new StudioDomainDnsNotificationService()
    expect(service).toBeDefined()
  })

  it("fingerprints map works", () => {
    const service = new StudioDomainDnsNotificationService()
    ;(service['fingerprints'] as any).set('test-fp', new Date())
    expect(service['fingerprints'].get('test-fp')).toBeDefined()
  })
})