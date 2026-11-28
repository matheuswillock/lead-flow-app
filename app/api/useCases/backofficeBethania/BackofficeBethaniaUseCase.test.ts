import { describe, expect, it, mock } from "bun:test"
mock.module("server-only", () => ({}))
const { BackofficeBethaniaUseCase } = await import("./BackofficeBethaniaUseCase")

function setup(senderUrl: string | undefined = "http://127.0.0.1:8787") {
  const repository = {
    getGlobalPause: mock(async () => true),
    listEventControls: mock(async () => [{ eventType: "agenda.daily_0700", paused: true }]),
    setGlobalPause: mock(async () => undefined),
    setEventPause: mock(async () => undefined),
    getSenderConfig: mock(async () => (senderUrl ? { webhookUrl: senderUrl } : null)),
    upsertSenderConfig: mock(async (input: { webhookUrl: string; actorProfileId: string }) => input),
    listLogs: mock(async () => ({
      rows: [
        {
          id: "l1",
          eventType: "agenda.daily_0700",
          status: "failed",
          errorCode: "X",
          createdAt: new Date(0),
          attempts: 3,
          phone: "+15551234567",
          message: "secret",
        },
      ],
      total: 1,
    })),
  }
  const fetcher = mock(async () => new Response("ok", { status: 200 }))
  const useCase = new BackofficeBethaniaUseCase(repository as any, { fetcher: fetcher as any, timeoutMs: 10 })
  return { useCase, repository, fetcher }
}

describe("BackofficeBethaniaUseCase", () => {
  it("returns fixed event descriptions, pause states, and safe configured sender URL", async () => {
    const { useCase } = setup()
    const result = await useCase.getOverview()
    expect(result.paused).toBe(true)
    expect(result.events).toHaveLength(4)
    expect(result.events.map((event) => event.eventType)).toEqual([
      "schedule.created_or_rescheduled", "agenda.daily_0700", "meeting.follow_up_1h", "agenda.overdue_1500",
    ])
    expect(result.events[1].paused).toBe(true)
    expect(result.sender.webhookUrl).toBe("http://127.0.0.1:8787/")
    expect(result.sender.health).toBe("healthy")
  })

  it("fails closed for malformed sender URL and never calls fetch", async () => {
    const { useCase, fetcher } = setup("file:///etc/passwd")
    const result = await useCase.getOverview()
    expect(result.sender.health).toBe("unconfigured")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("updates a validated global or event pause with actor ID", async () => {
    const { useCase, repository } = setup()
    await useCase.setPause({ scope: "event", eventType: "agenda.daily_0700", paused: true, actorProfileId: "actor-1" })
    expect(repository.setEventPause).toHaveBeenCalledWith({
      eventType: "agenda.daily_0700",
      paused: true,
      actorProfileId: "actor-1",
    })
    expect(await useCase.setPause({ scope: "event", eventType: "invalid", paused: true, actorProfileId: "actor-1" })).toBe(false)
  })

  it("returns paginated filtered logs without recipient, phone, message, or payload", async () => {
    const { useCase, repository } = setup()
    const result = await useCase.listLogs({ eventType: "agenda.daily_0700", status: "failed", page: 2, pageSize: 10 })
    expect(repository.listLogs).toHaveBeenCalledWith({
      eventType: "agenda.daily_0700",
      status: "failed",
      skip: 10,
      take: 10,
    })
    expect(result.total).toBe(1)
    expect(JSON.stringify(result)).not.toMatch(/15551234567|secret|recipient|phone|payload/)
  })

  it("queries only sender healthz with an abort timeout", async () => {
    const { useCase, fetcher } = setup()
    await useCase.getOverview()
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/healthz", expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) }))
  })

  it("accepts a public HTTPS origin configured in backoffice without a static origin allowlist", async () => {
    const { repository } = setup()
    const lookupHost = mock(async () => [{ address: "8.8.8.8", family: 4 }])
    const useCase = new BackofficeBethaniaUseCase(repository as any, {
      nodeEnv: "production",
      lookupHost,
    })

    await useCase.setSenderUrl({ webhookUrl: "https://bethania.example.net/", actorProfileId: "actor-1" })

    expect(lookupHost).toHaveBeenCalledWith("bethania.example.net")
    expect(repository.upsertSenderConfig).toHaveBeenCalledWith({
      webhookUrl: "https://bethania.example.net/",
      actorProfileId: "actor-1",
    })
  })

  it("still rejects a backoffice origin resolving to a private address", async () => {
    const { repository } = setup()
    const lookupHost = mock(async () => [{ address: "10.0.0.8", family: 4 }])
    const useCase = new BackofficeBethaniaUseCase(repository as any, {
      nodeEnv: "production",
      lookupHost,
    })

    await expect(useCase.setSenderUrl({
      webhookUrl: "https://bethania.example.net/",
      actorProfileId: "actor-1",
    })).rejects.toThrow("URL do conector não permitida")

    expect(repository.upsertSenderConfig).not.toHaveBeenCalled()
  })

  it("loads the public HTTPS origin persisted by backoffice without a static origin allowlist", async () => {
    const { repository } = setup("https://bethania.example.net/")
    const lookupHost = mock(async () => [{ address: "8.8.8.8", family: 4 }])
    const useCase = new BackofficeBethaniaUseCase(repository as any, {
      nodeEnv: "production",
      lookupHost,
    })

    await expect(useCase.getConfiguredSenderUrl()).resolves.toBe("https://bethania.example.net/")
    expect(lookupHost).toHaveBeenCalledWith("bethania.example.net")
  })

  it("returns overview data through the standard Output contract", async () => {
    const { useCase } = setup()
    const output = await useCase.execute({ operation: "overview" })
    expect(output.isValid).toBe(true)
    expect(output.result.paused).toBe(true)
    expect(output.result.events).toHaveLength(4)
  })

  it("returns a client error Output for an invalid pause event", async () => {
    const { useCase } = setup()
    const output = await useCase.execute({
      operation: "set-pause",
      scope: "event",
      eventType: "invalid",
      paused: true,
      actorProfileId: "actor-1",
    })
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Evento inválido"])
    expect(output.result).toEqual({ status: 400 })
  })
})
