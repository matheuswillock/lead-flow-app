import { describe, expect, it } from "bun:test"
import { StudioDomainDnsAuditService } from "./StudioDomainDnsAuditService"

function makeResult(
  status: StudioDomainDnsAuditService["auditDomain"] extends Promise<infer R> ? R : never,
  overrides: Partial<any> = {}
): any {
  // Minimal mock - just test the service structure
  return {
    status: "verified",
    fingerprint: "a".repeat(64),
    ...overrides,
  }
}

describe("StudioDomainDnsAuditService basic", () => {
  it("service can be instantiated", () => {
    const service = new StudioDomainDnsAuditService(
      {} as any
    )
    expect(service).toBeDefined()
  })
})