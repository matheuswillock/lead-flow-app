import { describe, expect, it } from "bun:test"
import { getCredentialDescriptors } from "./credential-schema"

describe("payment provider credential descriptors", () => {
  it("marks the Abacate Pay credentials required in DEV and public key optional in production", () => {
    expect(getCredentialDescriptors("ABACATE_PAY", "DEV")).toMatchObject({
      API_KEY: { required: true },
      WEBHOOK_SECRET: { required: true },
      PUBLIC_KEY: { required: true },
    })
    expect(getCredentialDescriptors("ABACATE_PAY", "PRODUCTION")).toMatchObject({
      API_KEY: { required: true },
      WEBHOOK_SECRET: { required: true },
      PUBLIC_KEY: { required: false },
    })
  })

  it("exposes Asaas credentials without claiming payment capabilities", () => {
    expect(getCredentialDescriptors("ASAAS", "PRODUCTION")).toHaveProperty("API_KEY")
  })
})
