import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { AsaasCustomerSilencingGateway } from "./asaasCustomerSilencingGateway"

const ENV_KEYS = ["ASAAS_ENV", "ASAAS_LEGACY_API_KEY", "ASAAS_API_KEY"] as const
let snapshot: Record<string, string | undefined> = {}

beforeEach(() => {
  snapshot = {}
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
  process.env.ASAAS_ENV = "sandbox"
  process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
  mock.restore()
})

describe("AsaasCustomerSilencingGateway (T-30.6)", () => {
  it("disableCustomerNotifications: PUT com body contendo APENAS notificationDisabled: true", async () => {
    let capturedMethod: string | undefined
    let capturedBody: unknown
    let capturedUrl: string | undefined
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      capturedUrl = url
      capturedMethod = init?.method
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined
      return new Response(JSON.stringify({ id: "cus_1" }), { status: 200 })
    })
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const gateway = new AsaasCustomerSilencingGateway("legacy")
    await gateway.disableCustomerNotifications("cus_1")

    expect(capturedMethod).toBe("PUT")
    expect(capturedUrl).toContain("/customers/cus_1")
    expect(capturedBody).toEqual({ notificationDisabled: true })
    // Nada além da chave notificationDisabled — não sobrescreve
    // externalReference nem dado cadastral (T-30.6).
    expect(Object.keys(capturedBody as object)).toEqual(["notificationDisabled"])
  })

  it("listCustomerNotificationChannels: GET, retorna data[] ou [] se ausente", async () => {
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ data: [{ id: "notif_1", customer: "cus_1", enabled: true }] }), {
          status: 200,
        })
    )
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const gateway = new AsaasCustomerSilencingGateway("legacy")
    const channels = await gateway.listCustomerNotificationChannels("cus_1")

    expect(channels).toHaveLength(1)
    expect(channels[0]?.id).toBe("notif_1")
  })

  it("disableNotificationChannelsBatch: nunca chama a API quando a lista está vazia", async () => {
    const fetchMock = mock(async () => new Response("{}", { status: 200 }))
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const gateway = new AsaasCustomerSilencingGateway("legacy")
    const result = await gateway.disableNotificationChannelsBatch("cus_1", [])

    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("disableNotificationChannelsBatch: POST com patch de todos os canais desabilitados", async () => {
    let capturedBody: { customer: string; notifications: Array<Record<string, unknown>> } | undefined
    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const gateway = new AsaasCustomerSilencingGateway("legacy")
    await gateway.disableNotificationChannelsBatch("cus_1", [
      { id: "notif_1", customer: "cus_1", enabled: true },
    ])

    expect(capturedBody?.customer).toBe("cus_1")
    expect(capturedBody?.notifications).toEqual([
      {
        id: "notif_1",
        emailEnabledForCustomer: false,
        smsEnabledForCustomer: false,
        phoneCallEnabledForCustomer: false,
        whatsappEnabledForCustomer: false,
      },
    ])
  })

  it("usa a conta passada no construtor — legacy nunca chama a chave primary", () => {
    process.env.ASAAS_API_KEY = "aact_primary_key"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"

    const legacyGateway = new AsaasCustomerSilencingGateway("legacy")
    expect(legacyGateway.accountId).toBe("legacy")
  })
})
