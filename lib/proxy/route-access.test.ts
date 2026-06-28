import { describe, expect, it } from "bun:test"
import {
  isAuthRedirectRoute,
  isLegacyTenantRoute,
  isPublicPageRoute,
  isSensitiveRoute,
  isTenantAppRoute,
  parseTenantPath,
  requiresAuth,
  requiresManagerRole,
} from "@/lib/proxy/route-access"

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

describe("parseTenantPath", () => {
  it("parses tenant routes with UUID prefix", () => {
    const parsed = parseTenantPath(`/${USER_A}/whatsapp`)
    expect(parsed).toEqual({
      tenantId: USER_A,
      routePath: "/whatsapp",
    })
  })

  it("returns null for non-UUID first segment", () => {
    expect(parseTenantPath("/not-a-uuid/crm")).toBeNull()
  })

  it("returns null when only UUID segment is present", () => {
    expect(parseTenantPath(`/${USER_A}`)).toBeNull()
  })
})

describe("requiresAuth", () => {
  it("requires auth for tenant whatsapp route", () => {
    expect(requiresAuth(`/${USER_A}/whatsapp`)).toBe(true)
    expect(isTenantAppRoute(`/${USER_A}/whatsapp`)).toBe(true)
  })

  it("requires auth for legacy crm route", () => {
    expect(requiresAuth("/crm")).toBe(true)
    expect(isLegacyTenantRoute("/crm")).toBe(true)
  })

  it("detects tenant mismatch candidates", () => {
    const parsed = parseTenantPath(`/${USER_B}/crm`)
    expect(parsed?.tenantId).toBe(USER_B)
    expect(parsed?.tenantId).not.toBe(USER_A)
  })
})

describe("isPublicPageRoute", () => {
  it("allows lead-form paths", () => {
    expect(isPublicPageRoute("/lead-form/some-id")).toBe(true)
  })

  it("does not treat sign-in as a generic public page", () => {
    expect(isPublicPageRoute("/sign-in")).toBe(false)
  })
})

describe("isAuthRedirectRoute", () => {
  it("marks sign-in as auth redirect route", () => {
    expect(isAuthRedirectRoute("/sign-in")).toBe(true)
  })
})

describe("requiresManagerRole", () => {
  it("requires manager for tenant manager-users route", () => {
    expect(requiresManagerRole(`/${USER_A}/manager-users`)).toBe(true)
  })

  it("requires manager for legacy integrations route", () => {
    expect(requiresManagerRole("/integrations")).toBe(true)
  })
})

describe("isSensitiveRoute", () => {
  it("marks backoffice routes as sensitive", () => {
    expect(isSensitiveRoute("/backoffice/clients")).toBe(true)
  })
})
