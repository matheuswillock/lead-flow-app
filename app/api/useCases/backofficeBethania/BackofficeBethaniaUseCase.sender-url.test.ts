import { describe, expect, it, mock } from "bun:test"
mock.module("server-only", () => ({}))
const { BackofficeBethaniaUseCase } = await import("./BackofficeBethaniaUseCase")

function database(config: { webhookUrl: string; updatedByProfileId: string } | null = null) {
  const senderConfig = {
    findUnique: mock(async () => config),
    upsert: mock(async ({ create }: { create: { webhookUrl: string; updatedByProfileId: string } }) => ({ webhookUrl: create.webhookUrl, updatedByProfileId: create.updatedByProfileId })),
  }
  return {
    senderConfig,
    db: {
      bethaniaSenderConfig: senderConfig,
      bethaniaGlobalControl: { findUnique: async () => null, upsert: async () => ({}) },
      bethaniaEventControl: { findMany: async () => [], upsert: async () => ({}) },
      bethaniaDeliveryLog: { findMany: async () => [], count: async () => 0 },
    },
  }
}

describe("Bethânia sender URL configuration", () => {
  it("stores and returns a validated URL with actor audit", async () => {
    const { db, senderConfig } = database()
    const useCase = new BackofficeBethaniaUseCase(db as never)

    await expect(useCase.setSenderUrl({ webhookUrl: "https://sender.example.com", actorProfileId: "profile-1" }))
      .resolves.toEqual({ webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" })
    expect(senderConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "singleton" },
      create: { id: "singleton", webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" },
      update: { webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" },
    }))
  })

  it("returns the validated persisted sender endpoint for the outbound worker", async () => {
    const { db } = database({ webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" });
    const useCase = new BackofficeBethaniaUseCase(db as never, {
      nodeEnv: "production",
      lookupHost: async () => [{ address: "8.8.8.8", family: 4 }],
    });

    await expect(useCase.getConfiguredSenderUrl()).resolves.toBe("https://sender.example.com/");
  });

  it("fails closed for a configured origin that resolves to a private address", async () => {
    const { db, senderConfig } = database({ webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" });
    const useCase = new BackofficeBethaniaUseCase(db as never, {
      nodeEnv: "production",
      lookupHost: async () => [{ address: "10.0.0.7", family: 4 }],
    });

    await expect(useCase.getConfiguredSenderUrl()).resolves.toBeNull();
    const overview = await useCase.getOverview();
    expect(overview.sender.health).toBe("unconfigured");
    expect(senderConfig.upsert).not.toHaveBeenCalled();
  });

  it("accepts a different public HTTPS origin selected in backoffice without a static allowlist", async () => {
    const { db, senderConfig } = database()
    const useCase = new BackofficeBethaniaUseCase(db as never, {
      nodeEnv: "production",
      lookupHost: async () => [{ address: "8.8.8.8", family: 4 }],
    })

    await expect(useCase.setSenderUrl({ webhookUrl: "https://attacker.example", actorProfileId: "profile-1" }))
      .resolves.toEqual({ webhookUrl: "https://attacker.example/", updatedByProfileId: "profile-1" })
    expect(senderConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { id: "singleton", webhookUrl: "https://attacker.example/", updatedByProfileId: "profile-1" },
    }))
  })

  it("rejects URL credentials, query, fragments and non-root paths", async () => {
    const { db } = database()
    const useCase = new BackofficeBethaniaUseCase(db as never)

    for (const webhookUrl of [
      "https://user:pass@sender.example.com",
      "https://sender.example.com?token=x",
      "https://sender.example.com#fragment",
      "https://sender.example.com/path",
      "ftp://sender.example.com",
    ]) {
      await expect(useCase.setSenderUrl({ webhookUrl, actorProfileId: "profile-1" })).rejects.toThrow()
    }
  })

  it("allows local HTTP loopback only outside production", async () => {
    const { db, senderConfig } = database()
    const development = new BackofficeBethaniaUseCase(db as never, { nodeEnv: "development" })
    const production = new BackofficeBethaniaUseCase(db as never, { nodeEnv: "production" })

    await expect(development.setSenderUrl({ webhookUrl: "http://127.0.0.1:8123", actorProfileId: "profile-1" })).resolves.toBeDefined()
    senderConfig.upsert.mockClear()
    await expect(production.setSenderUrl({ webhookUrl: "http://127.0.0.1:8123", actorProfileId: "profile-1" })).rejects.toThrow()
    expect(senderConfig.upsert).not.toHaveBeenCalled()
  })

  it("health-checks only the validated persisted URL with timeout and no redirects", async () => {
    const config = { webhookUrl: "https://sender.example.com/", updatedByProfileId: "profile-1" }
    const { db } = database(config)
    const fetcher = mock(async (_url: string | URL | Request, _options?: RequestInit) => new Response(null, { status: 204 }))
    const useCase = new BackofficeBethaniaUseCase(db as never, {
      fetcher,
      timeoutMs: 100,
    })

    const overview = await useCase.getOverview()
    expect(overview.sender.webhookUrl).toBe("https://sender.example.com/")
    expect(fetcher).toHaveBeenCalledWith("https://sender.example.com/healthz", expect.objectContaining({
      method: "GET", redirect: "manual", signal: expect.any(AbortSignal),
    }))
  })
})