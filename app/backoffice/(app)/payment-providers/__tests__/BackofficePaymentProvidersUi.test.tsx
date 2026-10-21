import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BackofficePaymentProvidersContainer } from "../features/container/BackofficePaymentProvidersContainer"
import { PaymentProvidersApiError } from "../features/context/BackofficePaymentProvidersTypes"
import {
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
  await screen.findByRole("heading", { name: "Abacate Pay principal" })
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
      makeInstance({ id: "cfg-2", displayName: "Asaas conta B", providerKey: "ASAAS", isDefault: false, paymentCapable: false }),
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
      makeInstance({ id: "cfg-2", displayName: "Abacate reserva", isDefault: false, configRevision: 9 }),
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
    const service = new FakePaymentProvidersService([makeInstance({ isDefault: false })])
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
