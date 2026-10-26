import { describe, expect, mock, test } from "bun:test"
import { act, renderHook } from "@testing-library/react"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const firstRecords = createDeferred<any>()
const getDomainRecordsMock = mock(() => {
  return firstRecords.promise
})

const emailSettingsService = {
  get: async () => ({}),
  getDomainRecords: getDomainRecordsMock,
  verifyDomain: async () => ({ status: "pending" as const }),
}

mock.module("@/lib/email/studio-email-host", () => ({
  useOptionalStudioEmailHost: () => ({
    services: { emailSettings: emailSettingsService },
  }),
}))

const { useEmailSettings } = await import("./EmailSettingsHook")

const pendingDomainResult = {
  status: "pending",
  records: [],
  region: "sa-east-1",
  dnsProvider: null,
  connectedAt: null,
  openTracking: true,
  clickTracking: true,
  trackingSubdomain: "links",
  events: [],
} as any

describe("useEmailSettings - verificação do domínio", () => {
  test("não agenda polling quando a consulta em voo resolve após o unmount", async () => {
    const scheduledCallbacks: Array<() => void> = []
    const originalSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((callback: TimerHandler) => {
      scheduledCallbacks.push(callback as () => void)
      return 1 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout

    try {
      const { result, unmount } = renderHook(() => useEmailSettings())
      await act(async () => {
        await Promise.resolve()
      })

      let verification!: Promise<void>
      await act(async () => {
        verification = result.current.handleVerifyDomain()
        await Promise.resolve()
      })

      await act(async () => {
        firstRecords.resolve(pendingDomainResult)
        unmount()
        await verification
      })

      expect(scheduledCallbacks).toHaveLength(0)
    } finally {
      globalThis.setTimeout = originalSetTimeout
    }
  })
})
