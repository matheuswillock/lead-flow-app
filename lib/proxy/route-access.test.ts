import { describe, expect, it } from "bun:test"
import {
  isAuthRedirectRoute,
  isBackofficeAppRoute,
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

  it("allows backoffice public lead form path", () => {
    expect(isPublicPageRoute("/backoffice-lead-form")).toBe(true)
  })


  it("permite o renderer público, mas não confunde a rota autenticada do time", () => {
    expect(isPublicPageRoute("/forms/formulario-publico")).toBe(true)
    expect(isPublicPageRoute(`/${USER_A}/forms`)).toBe(false)
    expect(requiresAuth(`/${USER_A}/forms`)).toBe(true)
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


  it("delega formulários às permissões dinâmicas de edição e aprovação", () => {
    expect(requiresManagerRole(`/${USER_A}/forms`)).toBe(false)
  })

})

describe("tenant associados route", () => {
  it("parses associados as tenant app route", () => {
    expect(isTenantAppRoute(`/${USER_A}/associados`)).toBe(true)
    expect(parseTenantPath(`/${USER_A}/associados`)?.routePath).toBe("/associados")
  })
})

describe("isSensitiveRoute", () => {
  it("marks backoffice routes as sensitive", () => {
    expect(isSensitiveRoute("/backoffice/clients")).toBe(true)
  })
})

describe("isBackofficeAppRoute", () => {
  it("matches /backoffice and its sub-routes", () => {
    expect(isBackofficeAppRoute("/backoffice")).toBe(true)
    expect(isBackofficeAppRoute("/backoffice/clients")).toBe(true)
    expect(isBackofficeAppRoute("/backoffice/emails/campanhas")).toBe(true)
  })

  it("does not match sibling public routes that merely share the prefix string", () => {
    expect(isBackofficeAppRoute("/backoffice-email-unsubscribe/some-token")).toBe(false)
    expect(isBackofficeAppRoute("/backoffice-lead-form")).toBe(false)
  })

  it("keeps isSensitiveRoute consistent with the same exact-segment rule", () => {
    expect(isSensitiveRoute("/backoffice-email-unsubscribe/some-token")).toBe(false)
  })
})
