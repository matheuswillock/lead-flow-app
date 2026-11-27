import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, mock } from "bun:test"
import { WhatsAppVerificationPanel } from "./WhatsAppVerificationPanel"

afterEach(() => {
  cleanup()
  mock.restore()
})

describe("WhatsAppVerificationPanel", () => {
  it("requests a code for the separate WhatsApp contact, verifies it and reports completion", async () => {
    const onVerified = mock(() => {})
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/request-code")) {
        expect(JSON.parse(String(init?.body))).toEqual({ phone: "+5511999999999" })
        return Response.json({ success: true, challengeId: "challenge-1" }, { status: 202 })
      }
      expect(url).toEndWith("/verify-code")
      expect(JSON.parse(String(init?.body))).toEqual({ challengeId: "challenge-1", code: "123456" })
      return Response.json({ success: true })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<WhatsAppVerificationPanel supabaseId="profile-1" whatsappPhone={null} verifiedAt={null} onVerified={onVerified} />)

    fireEvent.change(screen.getByLabelText("Número de WhatsApp"), { target: { value: "+5511999999999" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }))
    await screen.findByLabelText("Código de verificação")
    fireEvent.change(screen.getByLabelText("Código de verificação"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar código" }))

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("permite verificar um número novo without treating the previous verified phone as verified", () => {
    render(<WhatsAppVerificationPanel supabaseId="profile-1" whatsappPhone="+5511999999999" verifiedAt="2026-11-23T12:00:00.000Z" onVerified={() => {}} />)
    const requestButton = screen.getByRole("button", { name: "Enviar código" })
    expect((requestButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Número de WhatsApp"), { target: { value: "+5511888888888" } })
    expect((requestButton as HTMLButtonElement).disabled).toBe(false)
  })

  it("shows verified state for the WhatsApp number instead of the general phone", () => {
    render(<WhatsAppVerificationPanel supabaseId="profile-1" whatsappPhone="+5511999999999" verifiedAt="2026-11-23T12:00:00.000Z" onVerified={() => {}} />)
    expect(screen.getByText("WhatsApp verificado")).toBeTruthy()
    expect(screen.getByLabelText("Número de WhatsApp").getAttribute("value")).toBe("+5511999999999")
  })
})
