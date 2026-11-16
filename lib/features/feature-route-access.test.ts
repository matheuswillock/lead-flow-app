import { describe, expect, it } from "bun:test"
import { getFeatureSlugsForAppPath } from "./feature-route-access"

const TENANT_ID = "00000000-0000-0000-0000-000000000001"

describe("getFeatureSlugsForAppPath", () => {
  it("allows the integrations hub when lead-form is available without integration or radar", () => {
    expect(getFeatureSlugsForAppPath(`/${TENANT_ID}/integrations`)).toContain("lead-form")
  })

  it("keeps the dedicated lead-form page gated by its own feature slug", () => {
    expect(getFeatureSlugsForAppPath(`/${TENANT_ID}/integrations/lead-form`)).toEqual(["lead-form"])
  })
})
