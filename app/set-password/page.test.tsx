import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * Regressão do incidente 2026-10-19 (cliente com e-mail em tenant Microsoft 365):
 * o Safe Links abria o link de reset, executava o JS da página e consumia o
 * token de uso único no mount — o cliente recebia `otp_expired` ao clicar.
 * A validação agora só pode acontecer após clique explícito em "Continuar".
 *
 * Requer DOM: rode via `bun run test:ui` (preload happy-dom).
 */

type AuthSession = { user?: { email?: string } } | null

type AuthSessionResult = {
  data: { session: AuthSession }
  error: { message: string } | null
}

const verifyOtpMock = mock(async (): Promise<AuthSessionResult> => ({
  data: { session: { user: { email: "cliente@example.com" } } },
  error: null,
}))

const getSessionMock = mock(async (): Promise<AuthSessionResult> => ({
  data: { session: null },
  error: null,
}))

const pushMock = mock((_path: string) => {})
const routerMock = { push: pushMock }

let searchParamsValue = new URLSearchParams()

mock.module("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsValue,
}))

mock.module("@/lib/supabase/browser", () => ({
  createSupabaseBrowser: () => ({
    auth: {
      verifyOtp: verifyOtpMock,
      getSession: getSessionMock,
      setSession: mock(async () => ({ data: { session: null }, error: null })),
    },
  }),
}))

const { SetPasswordContent } = await import("./page")

beforeEach(() => {
  searchParamsValue = new URLSearchParams()
  verifyOtpMock.mockClear()
  getSessionMock.mockClear()
  pushMock.mockClear()
  window.history.replaceState(null, "", "/set-password")
})

afterEach(() => {
  cleanup()
})

describe("/set-password — gate do token de e-mail", () => {
  it("mount com token_hash não consome o token e pede confirmação", async () => {
    searchParamsValue = new URLSearchParams("token_hash=tok-abc&type=recovery")

    render(<SetPasswordContent />)

    const button = await screen.findByRole("button", { name: "Continuar" })
    expect(button).toBeDefined()
    expect(verifyOtpMock).not.toHaveBeenCalled()
    expect(
      screen.getByText("Confirme para validar o link e criar uma nova senha de acesso.")
    ).toBeDefined()
  })

  it("clique em Continuar valida o token uma única vez e abre o formulário", async () => {
    searchParamsValue = new URLSearchParams("token_hash=tok-abc&type=recovery")

    render(<SetPasswordContent />)

    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1))
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "tok-abc", type: "recovery" })
    await screen.findByText("Defina sua Senha")
  })

  it("token já consumido mostra erro de link usado ou expirado", async () => {
    searchParamsValue = new URLSearchParams("token_hash=tok-used&type=recovery")
    verifyOtpMock.mockImplementationOnce(async () => ({
      data: { session: null },
      error: { message: "Token has expired or is invalid" },
    }))

    render(<SetPasswordContent />)

    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

    await screen.findByText("Link Inválido ou Expirado")
    expect(
      screen.getByText("Este link já foi usado ou expirou. Solicite um novo link de acesso.")
    ).toBeDefined()
  })

  it("sem token na URL redireciona para o login sem validar token", async () => {
    render(<SetPasswordContent />)

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"))
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })
})
