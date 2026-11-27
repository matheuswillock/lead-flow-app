import { describe, expect, it } from "bun:test"
import { resolveBethaniaSafeReturnPath } from "./safe-return-path"

const profileId = "5b36cd1a-898b-4545-b8ed-97469fd24a34"

describe("resolveBethaniaSafeReturnPath", () => {
  it("keeps an authenticated app path for the same profile", () => {
    expect(resolveBethaniaSafeReturnPath(`/${profileId}/crm/leads`, profileId)).toBe(
      `/${profileId}/crm/leads`,
    )
  })

  it("rejects absolute, protocol-relative, and cross-profile destinations", () => {
    expect(resolveBethaniaSafeReturnPath("https://evil.example/", profileId)).toBeNull()
    expect(resolveBethaniaSafeReturnPath("//evil.example/path", profileId)).toBeNull()
    expect(resolveBethaniaSafeReturnPath("/other-profile/crm", profileId)).toBeNull()
  })

  it("rejects encoded separators, backslashes, and control characters", () => {
    expect(resolveBethaniaSafeReturnPath(`/${profileId}/crm%2f..%2fadmin`, profileId)).toBeNull()
    expect(resolveBethaniaSafeReturnPath(`\\evil.example/${profileId}/crm`, profileId)).toBeNull()
    expect(resolveBethaniaSafeReturnPath(`/${profileId}/crm\nredirect`, profileId)).toBeNull()
  })

  it("drops query and hash so nested redirect parameters cannot escape the account", () => {
    expect(resolveBethaniaSafeReturnPath(`/${profileId}/crm?next=//evil#item`, profileId)).toBe(
      `/${profileId}/crm`,
    )
  })
})
