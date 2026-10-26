import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { EmailCreditPlan } from "@prisma/client"
import { ValidarEmailCreditosUseCase } from "./ValidarEmailCreditosUseCase"

const access = {
  supabaseId: "sb-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "dono@example.test",
} as TeamAccess

type SubscribeCall = [EmailCreditPlan, TeamAccess, "PIX" | "CREDIT_CARD"]

const subscribeMock = mock(
  async (..._args: SubscribeCall) =>
    new Output(true, [], [], {
      checkoutId: "purchase-1",
      checkoutUrl: "https://app.test/addon-checkout/purchase-1",
    }),
)
const notifyMock = mock(async (_payload: unknown) => ({ success: true }))

function buildUseCase() {
  return new ValidarEmailCreditosUseCase(
    { subscribe: subscribeMock } as never,
    { notify: notifyMock } as never,
  )
}

describe("ValidarEmailCreditosUseCase — compra para o usuário autenticado", () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    notifyMock.mockClear()
  })

  it("25k cria a compra do plano upgrade em PIX para o time autenticado e devolve o checkout interno", async () => {
    const output = await buildUseCase().execute({ plan: "25k", access })

    expect(output.isValid).toBe(true)
    expect(subscribeMock).toHaveBeenCalledWith("upgrade", access, "PIX")
    expect(output.result).toEqual({
      checkoutUrl: "https://app.test/addon-checkout/purchase-1",
      plan: "25k",
    })
  })

  it("50k cria a compra do plano business", async () => {
    await buildUseCase().execute({ plan: "50k", access })

    expect(subscribeMock).toHaveBeenCalledWith("business", access, "PIX")
  })

  it("plano inválido não cria compra", async () => {
    const output = await buildUseCase().execute({ plan: "10k" as never, access })

    expect(output.isValid).toBe(false)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it("falha ao criar a compra propaga o erro e não notifica o Slack", async () => {
    subscribeMock.mockResolvedValueOnce(new Output(false, [], ["Sem acesso"], null))

    const output = await buildUseCase().execute({ plan: "25k", access })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Sem acesso"])
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it("notifica o Slack só com dados do profile autenticado", async () => {
    await buildUseCase().execute({ plan: "25k", access })

    expect(notifyMock).toHaveBeenCalledWith({
      email: "dono@example.test",
      plan: "25k",
      profileId: "profile-1",
    })
  })

  it("falha do Slack não derruba a compra", async () => {
    notifyMock.mockResolvedValueOnce({ success: false, error: "slack off" } as never)

    const output = await buildUseCase().execute({ plan: "25k", access })

    expect(output.isValid).toBe(true)
  })
})
