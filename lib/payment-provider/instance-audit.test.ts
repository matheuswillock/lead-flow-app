import { describe, expect, it } from "bun:test"
import { changedFields, snapshotInstance, toHistoryItem } from "./instance-audit"
import type { ProviderInstanceRecord } from "./instance"

const record: ProviderInstanceRecord = {
  id: "i1",
  provider: "ABACATE_PAY",
  environment: "DEV",
  enabled: false,
  isDefault: false,
  externalAccountContext: "abacate-dev",
  rolloutState: "DISABLED",
  killSwitch: false,
  revision: 1,
  healthStatus: "UNKNOWN",
  displayName: "Abacate",
  logoUrl: null,
  logoAltText: null,
  settings: {},
  lastHealthCheckAt: null,
  lastErrorCode: null,
}

describe("instance audit", () => {
  it("snapshot não tem espaço para segredo: só campos de roteamento e metadados", () => {
    expect(Object.keys(snapshotInstance(record)).sort()).toEqual([
      "cardEnabled",
      "displayName",
      "enabled",
      "externalAccountContext",
      "isDefault",
      "killSwitch",
      "logoAltText",
      "logoUrl",
      "requireSignature",
      "rolloutState",
    ])
  })

  it("lista só os campos alterados", () => {
    const after = snapshotInstance({ ...record, killSwitch: true, displayName: "Novo" })
    expect(changedFields(snapshotInstance(record), after).sort()).toEqual(["displayName", "killSwitch"])
  })

  it("histórico: ator por e-mail do backoffice, resumo por operação", () => {
    const item = toHistoryItem({
      createdAt: new Date("2026-10-21T12:00:00.000Z"),
      actorProfileId: "p1",
      metadata: { operation: "provider_credential_rotated", credentialKey: "API_KEY", backofficeEmail: "a@b.com" },
    })
    expect(item).toEqual({
      at: "2026-10-21T12:00:00.000Z",
      actor: "a@b.com",
      operation: "provider_credential_rotated",
      summary: "Credencial rotacionada: API_KEY",
    })
    expect(
      toHistoryItem({
        createdAt: new Date(0),
        actorProfileId: null,
        metadata: { operation: "provider_instance_updated", changedFields: ["isDefault"] },
      }),
    ).toMatchObject({ actor: "sistema", summary: "Instância alterada: isDefault" })
  })
})
