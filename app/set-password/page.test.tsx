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

type AuthSession = { user?: { email?: string; id?: string } } | null

type AuthSessionResult = {
  data: { session: AuthSession }
  error: { message: string } | null
}

const verifyOtpMock = mock(
  async (): Promise<AuthSessionResult> => ({
    data: { session: { user: { email: "cliente@example.com" } } },
    error: null,
  }),
)

const getSessionMock = mock(
  async (): Promise<AuthSessionResult> => ({
    data: { session: null },
    error: null,
  }),
)
const updateUserMock = mock(async () => ({ error: null as { message: string } | null }))
const getUserMock = mock(async () => ({ data: { user: { id: "user-123" } } }))
const originalFetch = globalThis.fetch
const fetchMock = mock(async (input: RequestInfo | URL) => ({
  ok: true,
  json: async () =>
    String(input).includes("/profiles/")
      ? { isValid: true, result: { role: "user" } }
      : { accepted: true },
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
      updateUser: updateUserMock,
      getUser: getUserMock,
      setSession: mock(async () => ({ data: { session: null }, error: null })),
    },
  }),
}))

const { SetPasswordContent } = await import("./page")

beforeEach(() => {
  searchParamsValue = new URLSearchParams()
  verifyOtpMock.mockClear()
  getSessionMock.mockClear()
  updateUserMock.mockClear()
  getUserMock.mockClear()
  fetchMock.mockClear()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  pushMock.mockClear()
  window.history.replaceState(null, "", "/set-password")
})

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

function telemetryEvents(): string[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).includes("/auth/password-reset/telemetry"))
    .map(([, init]) => JSON.parse(String(init?.body)).eventType as string)
}

describe("/set-password — gate do token de e-mail", () => {
  it("mount com token_hash não consome o token e pede confirmação", async () => {
    searchParamsValue = new URLSearchParams("flowId=flow-123&token_hash=tok-abc&type=recovery")

    render(<SetPasswordContent />)

    const button = await screen.findByRole("button", { name: "Continuar" })
    expect(button).toBeDefined()
    expect(verifyOtpMock).not.toHaveBeenCalled()
    expect(
      screen.getByText("Confirme para validar o link e criar uma nova senha de acesso."),
    ).toBeDefined()
    await waitFor(() => expect(telemetryEvents()).toEqual(["page_opened"]))
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("tok-abc")
    const telemetryCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/auth/password-reset/telemetry"),
    )
    expect(telemetryCall?.[1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
  })

  it("clique em Continuar valida o token uma única vez e abre o formulário", async () => {
    searchParamsValue = new URLSearchParams("flowId=flow-123&token_hash=tok-abc&type=recovery")

    render(<SetPasswordContent />)

    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1))
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "tok-abc", type: "recovery" })
    await screen.findByText("Defina sua Senha")
    await waitFor(() =>
      expect(telemetryEvents()).toEqual(["page_opened", "verification_started", "token_verified"]),
    )
    expect(window.location.search).toBe("")
    expect(window.location.hash).toBe("")
  })

  it("cliques concorrentes não reutilizam o token enquanto a validação está pendente", async () => {
    searchParamsValue = new URLSearchParams("token_hash=tok-once&type=recovery")
    let resolveVerification: ((result: AuthSessionResult) => void) | undefined
    verifyOtpMock.mockImplementationOnce(
      () =>
        new Promise<AuthSessionResult>((resolve) => {
          resolveVerification = resolve
        }),
    )

    render(<SetPasswordContent />)

    const button = await screen.findByRole("button", { name: "Continuar" })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(verifyOtpMock).toHaveBeenCalledTimes(1)
    resolveVerification?.({
      data: { session: { user: { email: "cliente@example.com" } } },
      error: null,
    })
    await screen.findByText("Defina sua Senha")
  })

  it("token já consumido mostra erro de link usado ou expirado", async () => {
    searchParamsValue = new URLSearchParams("flowId=flow-123&token_hash=tok-used&type=recovery")
    verifyOtpMock.mockImplementationOnce(async () => ({
      data: { session: null },
      error: { message: "Token has expired or is invalid" },
    }))

    render(<SetPasswordContent />)

    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

    await screen.findByText("Link Inválido ou Expirado")
    expect(
      screen.getByText("Este link já foi usado ou expirou. Solicite um novo link de acesso."),
    ).toBeDefined()
  })

  it("falha explícita com otp_expired não tenta validar novamente", async () => {
    searchParamsValue = new URLSearchParams("token_hash=tok-expired&type=recovery")
    verifyOtpMock.mockImplementationOnce(async () => ({
      data: { session: null },
      error: { message: "otp_expired" },
    }))

    render(<SetPasswordContent />)

    const button = await screen.findByRole("button", { name: "Continuar" })
    fireEvent.click(button)
    await screen.findByText("Link Inválido ou Expirado")

    expect(verifyOtpMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText("Este link já foi usado ou expirou. Solicite um novo link de acesso."),
    ).toBeDefined()
    await waitFor(() =>
      expect(telemetryEvents()).toEqual(["page_opened", "verification_started", "token_rejected"]),
    )
  })

  it("registra falha ao atualizar a senha sem enviar a senha", async () => {
    searchParamsValue = new URLSearchParams("flowId=flow-123&token_hash=tok-abc&type=recovery")
    updateUserMock.mockResolvedValueOnce({ error: { message: "Invalid token" } })

    render(<SetPasswordContent />)
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    await screen.findByText("Defina sua Senha")

    fireEvent.change(screen.getByLabelText("Nova Senha"), { target: { value: "ValidPass1" } })
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), { target: { value: "ValidPass1" } })
    fireEvent.click(screen.getByRole("button", { name: "Gerar senha" }))

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(telemetryEvents()).toEqual([
        "page_opened",
        "verification_started",
        "token_verified",
        "password_update_failed",
      ]),
    )
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("ValidPass1")
  })

  it("registra atualização bem-sucedida da senha", async () => {
    searchParamsValue = new URLSearchParams("flowId=flow-123&token_hash=tok-abc&type=recovery")

    render(<SetPasswordContent />)
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))
    await screen.findByText("Defina sua Senha")

    fireEvent.change(screen.getByLabelText("Nova Senha"), { target: { value: "ValidPass1" } })
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), { target: { value: "ValidPass1" } })
    fireEvent.click(screen.getByRole("button", { name: "Gerar senha" }))

    await screen.findByText("Senha Definida com Sucesso!")
    expect(telemetryEvents()).toEqual([
      "page_opened",
      "verification_started",
      "token_verified",
      "password_updated",
    ])
  })

  it("sem token na URL redireciona para o login sem validar token", async () => {
    render(<SetPasswordContent />)

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"))
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })
})
