import { describe, it, expect, mock, beforeEach } from "bun:test"
import {
  DEFAULT_PUBLISH_RETRY_ATTEMPTS,
  publishWithRetry,
} from "./publish-with-retry"

const instantBackoff = { backoffMs: [0, 0, 0] }

describe("publishWithRetry", () => {
  let publish: ReturnType<typeof mock<() => Promise<{ messageId: string }>>>

  beforeEach(() => {
    publish = mock(async () => ({ messageId: "mid-1" }))
  })

  it("sucesso na 1ª tentativa: chama publish 1 vez e não espera backoff", async () => {
    const result = await publishWithRetry(publish)

    expect(publish).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      result: { messageId: "mid-1" },
      attempts: 1,
    })
  })

  it("sucesso na 3ª tentativa após falhar as 2 primeiras", async () => {
    const lastError = new Error("transient-2")
    publish
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(lastError)
      .mockResolvedValueOnce({ messageId: "mid-3" })

    const result = await publishWithRetry(publish, instantBackoff)

    expect(publish).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      ok: true,
      result: { messageId: "mid-3" },
      attempts: 3,
    })
  })

  it("falha nas 3 tentativas: não chama uma 4ª vez e não lança", async () => {
    const lastError = new Error("final-failure")
    publish
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockRejectedValueOnce(lastError)

    await expect(
      publishWithRetry(publish, instantBackoff)
    ).resolves.toEqual({
      ok: false,
      error: lastError,
      attempts: DEFAULT_PUBLISH_RETRY_ATTEMPTS,
    })
    expect(publish).toHaveBeenCalledTimes(3)
  })

  it("respeita options.attempts customizado", async () => {
    const onlyError = new Error("single-fail")
    publish.mockRejectedValueOnce(onlyError)

    await expect(
      publishWithRetry(publish, { attempts: 1 })
    ).resolves.toEqual({
      ok: false,
      error: onlyError,
      attempts: 1,
    })
    expect(publish).toHaveBeenCalledTimes(1)
  })
})
