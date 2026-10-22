import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BackofficePaymentProvidersContainer } from "../features/container/BackofficePaymentProvidersContainer"
import { PaymentProvidersApiError } from "../features/context/BackofficePaymentProvidersTypes"
import {
  ALL_CREDENTIALS_SET,
  FakePaymentProvidersService,
  SECRET_SENTINEL,
  installBrowserStubs,
  makeInstance,
  renderWithProviders,
  stubCurrentUser,
} from "./testHarness"

let restoreFetch: (() => void) | null = null

beforeAll(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
  restoreFetch?.()
  restoreFetch = null
})

async function renderPage(service: FakePaymentProvidersService, options: { isOperator?: boolean } = {}) {
  restoreFetch = stubCurrentUser(options.isOperator ?? false)
  render(renderWithProviders(service, <BackofficePaymentProvidersContainer />))
  await screen.findAllByRole("heading", { level: 2 })
  if (!options.isOperator) await screen.findByRole("button", { name: "Nova instância" })
}

async function openManage(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`(Gerenciar|Ver) ${name}`) }))
  return screen.findByRole("dialog")
}

describe("página de providers de pagamento", () => {
  it("lista as instâncias do ambiente com saúde, rollout, padrão e marca de somente credenciais", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance(),
      makeInstance({ id: "cfg-2", displayName: "Asaas conta B", providerKey: "ASAAS", isDefault: false, paymentCapable: false, healthStatus: "UNHEALTHY", lastErrorCode: "AUTH_FAILED" }),
    ])
    await renderPage(service)

    expect(screen.getByText("Padrão")).toBeTruthy()
    expect(screen.getByText("Somente credenciais")).toBeTruthy()
    expect(screen.getByText("Com falha")).toBeTruthy()
    expect(screen.getByText(/AUTH_FAILED/)).toBeTruthy()
    expect(service.calls).toContainEqual({ method: "listInstances", args: ["PRODUCTION"] })
  })

  it("nunca renderiza o valor da credencial depois de salvar e limpa o campo", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    const input = within(sheet).getByLabelText("Segredo do webhook") as HTMLInputElement
    expect(input.type).toBe("password")
    fireEvent.change(input, { target: { value: SECRET_SENTINEL } })
    fireEvent.click(within(sheet).getAllByRole("button", { name: "Salvar" })[0])

    await waitFor(() => expect(service.calls.some((c) => c.method === "setCredential")).toBe(true))
    await waitFor(() => expect(input.value).toBe(""))
    expect(document.body.innerHTML).not.toContain(SECRET_SENTINEL)
    expect(document.body.textContent).not.toContain(SECRET_SENTINEL)
    for (const field of Array.from(document.querySelectorAll("input"))) {
      expect((field as HTMLInputElement).value).not.toContain(SECRET_SENTINEL)
    }
    expect(await within(sheet).findByText(/Termina em 9f3a/)).toBeTruthy()
  })

  it("mostra placeholder de já definido e não envia valor vazio", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    const apiKey = within(sheet).getByLabelText("Chave de API") as HTMLInputElement
    expect(apiKey.placeholder).toBe("•••• (já definido)")
    const rotate = within(sheet).getByRole("button", { name: "Rotacionar" }) as HTMLButtonElement
    expect(rotate.disabled).toBe(true)
    expect(service.calls.some((c) => c.method === "setCredential")).toBe(false)
  })

  it("desabilita tornar padrão para instância somente de credenciais e explica o motivo", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance({
        id: "cfg-2",
        displayName: "Asaas conta B",
        providerKey: "ASAAS",
        isDefault: false,
        paymentCapable: false,
        applicableSettings: [],
        defaultBlockers: ["Somente credenciais: o adapter ainda não declara capacidades de pagamento."],
      }),
      makeInstance(),
    ])
    await renderPage(service)
    const sheet = await openManage("Asaas conta B")

    const button = within(sheet).getByRole("button", { name: "Tornar padrão" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(within(sheet).getByTestId("make-default-reason").textContent).toContain("Somente credenciais")
  })

  it("confirma a troca do padrão mostrando o padrão atual e envia expectedRevision", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance(),
      makeInstance({ id: "cfg-2", displayName: "Abacate reserva", isDefault: false, configRevision: 9, credentials: ALL_CREDENTIALS_SET }),
    ])
    await renderPage(service)
    const sheet = await openManage("Abacate reserva")

    fireEvent.click(within(sheet).getByRole("button", { name: "Tornar padrão" }))
    const confirmation = await screen.findByRole("alertdialog")
    expect(confirmation.textContent).toContain("O padrão atual é “Abacate Pay principal”")
    fireEvent.click(within(confirmation).getByRole("button", { name: "Tornar padrão" }))

    await waitFor(() => expect(service.calls.some((c) => c.method === "updateInstance")).toBe(true))
    const update = service.calls.find((c) => c.method === "updateInstance")!
    expect(update.args[0]).toEqual({ id: "cfg-2", expectedRevision: 9, isDefault: true })
  })

  it("em 409 recarrega as instâncias em vez de manter o estado antigo", async () => {
    const service = new FakePaymentProvidersService([makeInstance({ isDefault: false, credentials: ALL_CREDENTIALS_SET })])
    service.failNextUpdateWith = new PaymentProvidersApiError("Revisão desatualizada", 409)
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    fireEvent.click(within(sheet).getByRole("button", { name: "Tornar padrão" }))
    const confirmation = await screen.findByRole("alertdialog")
    fireEvent.click(within(confirmation).getByRole("button", { name: "Tornar padrão" }))

    await waitFor(() => expect(service.calls.filter((c) => c.method === "listInstances")).toHaveLength(2))
  })

  it("operador vê somente leitura mascarada, sem escrita", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    await renderPage(service, { isOperator: true })

    expect(screen.queryByRole("button", { name: "Nova instância" })).toBeNull()
    const sheet = await openManage("Abacate Pay principal")
    expect(sheet.querySelectorAll('input[type="password"]')).toHaveLength(0)
    expect(within(sheet).queryByRole("button", { name: "Rotacionar" })).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Tornar padrão" })).toBeNull()
    expect(within(sheet).queryByRole("button", { name: "Verificar saúde" })).toBeNull()
    expect(within(sheet).getByText(/Termina em ab12/)).toBeTruthy()
  })

  it("mantém criar instância desabilitado até escolher o adapter", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    await renderPage(service)

    fireEvent.click(screen.getByRole("button", { name: "Nova instância" }))
    const dialog = await screen.findByRole("dialog")
    const create = within(dialog).getByRole("button", { name: "Criar instância" }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText("Contexto da conta externa"), { target: { value: "conta-b" } })
    fireEvent.change(within(dialog).getByLabelText("Nome exibido"), { target: { value: "Conta B" } })
    expect(create.disabled).toBe(true) // adapter ainda não escolhido
  })
})

describe("correções de usabilidade da página de providers", () => {
  it("lista cada bloqueio e mantém Tornar padrão desabilitado e fora de destaque", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance(),
      makeInstance({
        id: "cfg-2",
        displayName: "Abacate reserva",
        isDefault: false,
        killSwitch: true,
        rolloutState: "APPROVED",
        defaultBlockers: [
          "O kill switch está ativo.",
          "O rollout está em “Aprovado”; precisa estar em “Ativo”.",
          "Credenciais obrigatórias faltando: WEBHOOK_SECRET.",
        ],
      }),
    ])
    await renderPage(service)
    const sheet = await openManage("Abacate reserva")

    const button = within(sheet).getByRole("button", { name: "Tornar padrão" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.className).not.toContain("btn-primary-accessible")
    const reasons = within(sheet).getByTestId("make-default-reason").textContent ?? ""
    expect(reasons).toContain("kill switch")
    expect(reasons).toContain("rollout")
    expect(reasons).toContain("WEBHOOK_SECRET")
  })

  it("habilita Tornar padrão (destaque primário) quando não há bloqueios", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance(),
      makeInstance({ id: "cfg-2", displayName: "Abacate reserva", isDefault: false, credentials: ALL_CREDENTIALS_SET }),
    ])
    await renderPage(service)
    const sheet = await openManage("Abacate reserva")

    const button = within(sheet).getByRole("button", { name: "Tornar padrão" }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(within(sheet).queryByTestId("make-default-reason")).toBeNull()
  })

  it("não mostra interruptores nem credencial de política em instância somente de credenciais", async () => {
    const service = new FakePaymentProvidersService([
      makeInstance({
        id: "cfg-2",
        displayName: "Asaas conta B",
        providerKey: "ASAAS",
        isDefault: false,
        paymentCapable: false,
        applicableSettings: [],
        credentials: [
          ...ALL_CREDENTIALS_SET,
          { key: "REQUIRE_SIGNATURE", isSet: false, last4: null, fingerprint: null, required: true, updatedAt: null },
        ],
      }),
    ])
    await renderPage(service)
    const sheet = await openManage("Asaas conta B")

    expect(within(sheet).queryByLabelText("Exigir assinatura do webhook")).toBeNull()
    expect(within(sheet).queryByLabelText("Cartão habilitado")).toBeNull()
    expect(within(sheet).queryByLabelText(/REQUIRE_SIGNATURE/)).toBeNull()
    expect(within(sheet).getByLabelText("Kill switch")).toBeTruthy()
  })

  it("respeita applicableSettings enviado pelo servidor", async () => {
    const service = new FakePaymentProvidersService([makeInstance({ applicableSettings: ["cardEnabled"] })])
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    expect(within(sheet).queryByLabelText("Exigir assinatura do webhook")).toBeNull()
    expect(within(sheet).getByLabelText("Cartão habilitado")).toBeTruthy()
  })

  it("após 409 mantém o rascunho, mostra aviso persistente e permite reenviar", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    service.failNextUpdateWith = new PaymentProvidersApiError("Revisão desatualizada", 409)
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    const name = within(sheet).getByLabelText("Nome exibido") as HTMLInputElement
    fireEvent.change(name, { target: { value: "Nome novo" } })
    fireEvent.click(within(sheet).getByRole("button", { name: "Salvar identidade" }))

    expect(await within(sheet).findByTestId("conflict-notice")).toBeTruthy()
    expect(name.value).toBe("Nome novo")
    const save = within(sheet).getByRole("button", { name: "Salvar identidade" }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))

    fireEvent.click(save)
    await waitFor(() => expect(service.calls.filter((c) => c.method === "updateInstance")).toHaveLength(2))
    const second = service.calls.filter((c) => c.method === "updateInstance")[1]
    expect(second.args[0]).toMatchObject({ displayName: "Nome novo" })
    await waitFor(() => expect(within(sheet).queryByTestId("conflict-notice")).toBeNull())
  })

  it("erro ao salvar credencial fica inline, limpa o campo e nunca ecoa o valor", async () => {
    const service = new FakePaymentProvidersService([makeInstance()])
    service.failNextCredentialWith = new PaymentProvidersApiError(`Chave inválida: ${SECRET_SENTINEL}`, 422)
    await renderPage(service)
    const sheet = await openManage("Abacate Pay principal")

    const input = within(sheet).getByLabelText("Segredo do webhook") as HTMLInputElement
    fireEvent.change(input, { target: { value: SECRET_SENTINEL } })
    fireEvent.click(within(sheet).getAllByRole("button", { name: "Salvar" })[0])

    const alert = await within(sheet).findByTestId("credential-error-WEBHOOK_SECRET")
    expect(alert.textContent).toContain("Digite o valor novamente")
    expect(input.value).toBe("")
    expect(document.body.innerHTML).not.toContain(SECRET_SENTINEL)
    expect(document.body.textContent).not.toContain(SECRET_SENTINEL)
  })

  it("estado vazio tem um único CTA Nova instância", async () => {
    const service = new FakePaymentProvidersService([])
    restoreFetch = stubCurrentUser(false)
    render(renderWithProviders(service, <BackofficePaymentProvidersContainer />))
    await screen.findByText("Nenhuma instância neste ambiente")
    await screen.findByRole("button", { name: "Nova instância" })

    expect(screen.getAllByRole("button", { name: "Nova instância" })).toHaveLength(1)
  })

  it("subtítulo não repete a palavra conta", async () => {
    const service = new FakePaymentProvidersService([makeInstance({ externalAccountContext: "conta-prod-a" })])
    await renderPage(service)

    expect(document.body.textContent).toContain("Abacate Pay · contexto conta-prod-a")
    expect(document.body.textContent).not.toContain("conta conta-prod-a")
  })
})
