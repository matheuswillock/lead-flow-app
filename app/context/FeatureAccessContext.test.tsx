import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

mock.module("./UserContext", () => ({
  useUserContext: () => ({ user: { id: "profile-1", supabaseId: "supabase-1" } }),
}))

mock.module("./TeamContext", () => ({
  useTeamContext: () => ({ activeTeamId: "team-1" }),
}))

const { FeatureAccessProvider, useFeatureAccess } = await import("./FeatureAccessContext")

function AccessSlugs() {
  const { slugs } = useFeatureAccess()
  return <div>{slugs.join(",")}</div>
}

describe("FeatureAccessProvider focus refresh", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({
      isValid: true,
      result: { slugs: ["email"], betaSlugs: ["email"], betaLabelSlugs: ["email"] },
    }))) as unknown as typeof fetch
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it("refreshes team access on focus even while the client cache is fresh", async () => {
    render(
      <FeatureAccessProvider
        initialAccess={{
          slugs: [],
          betaSlugs: [],
          betaLabelSlugs: [],
          userRole: null,
          profileId: "profile-1",
          teamId: "team-1",
        }}
      >
        <AccessSlugs />
      </FeatureAccessProvider>
    )

    window.dispatchEvent(new Event("focus"))

    await waitFor(() => expect(screen.getByText("email")).toBeTruthy())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
