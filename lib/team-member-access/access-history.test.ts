import { describe, expect, it } from "bun:test"
import { describeAccessEmailStatus, describeAccessSummary, type AccessEmailDispatchStatus } from "./access-history"

describe("describeAccessSummary", () => {
  it("e-mail devolvido depois do último acesso aparece primeiro, como problema", () => {
    expect(describeAccessSummary({
      lastSignInAt: "2026-11-01T12:00:00.000Z",
      lastEmail: { status: "bounced", createdAt: "2026-11-05T12:00:00.000Z" },
    })).toEqual({ label: "E-mail não entregue", tone: "danger" })
  })

  it("quem acessou depois de um e-mail devolvido mostra o acesso", () => {
    expect(describeAccessSummary({
      lastSignInAt: "2026-11-06T12:00:00.000Z",
      lastEmail: { status: "bounced", createdAt: "2026-11-05T12:00:00.000Z" },
    })).toEqual({ label: "Acessou em 06/11", tone: "success" })
  })

  it("sem acesso e sem problema de entrega: aguardando primeiro acesso", () => {
    expect(describeAccessSummary({
      lastSignInAt: null,
      lastEmail: { status: "delivered", createdAt: "2026-11-05T12:00:00.000Z" },
    })).toEqual({ label: "Aguardando primeiro acesso", tone: "warning" })
    expect(describeAccessSummary({ lastSignInAt: null, lastEmail: null }).tone).toBe("warning")
  })
})

describe("describeAccessEmailStatus", () => {
  it("entregue orienta a olhar o spam", () => {
    const result = describeAccessEmailStatus("delivered")

    expect(result).toMatchObject({ label: "Entregue", tone: "success" })
    expect(result.hint).toContain("spam")
  })

  it("devolvido pede para conferir o endereço", () => {
    expect(describeAccessEmailStatus("bounced")).toMatchObject({ label: "Não entregue", tone: "danger" })
    expect(describeAccessEmailStatus("bounced").hint).toContain("Confira o e-mail")
  })

  it("todo status tem rótulo", () => {
    const statuses: AccessEmailDispatchStatus[] = [
      "queued", "sent", "delivered", "opened", "clicked", "bounced", "complained", "failed", "delivery_delayed", "suppressed",
    ]
    for (const status of statuses) {
      expect(describeAccessEmailStatus(status).label.length).toBeGreaterThan(0)
    }
  })
})
