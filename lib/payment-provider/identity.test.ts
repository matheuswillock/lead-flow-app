import { describe, expect, it } from "bun:test"
import {
  createProviderIdentityKey,
  assertProviderIdentityBindingImmutable,
  type ProviderIdentityBinding,
} from "./identity"

const binding: ProviderIdentityBinding = {
  provider: "ASAAS",
  environment: "PRODUCTION",
  externalAccountContext: "primary",
  externalId: "cus_123",
  identityType: "CUSTOMER",
  ownerType: "PROFILE",
  ownerId: "profile-1",
  tenantId: "tenant-1",
  route: "LEGACY_ASAAS",
  routeVersion: "legacy-v1",
}

describe("provider identity binding", () => {
  it("cria uma chave completa de identidade externa", () => {
    expect(createProviderIdentityKey(binding)).toBe("ASAAS|PRODUCTION|primary|cus_123|CUSTOMER")
  })

  it("rejeita referência externa sem contexto de conta", () => {
    expect(() => createProviderIdentityKey({ ...binding, externalAccountContext: " " })).toThrow(
      "contexto da conta",
    )
  })

  it("impede rebinding de provider, ambiente, conta ou rota", () => {
    expect(() =>
      assertProviderIdentityBindingImmutable(binding, {
        ...binding,
        externalAccountContext: "legacy",
      }),
    ).toThrow("imutável")
  })

  it("aceita atualização de revisão sem alterar o binding", () => {
    expect(() =>
      assertProviderIdentityBindingImmutable(binding, {
        ...binding,
        routeVersion: "legacy-v2",
      }),
    ).not.toThrow()
  })
})
