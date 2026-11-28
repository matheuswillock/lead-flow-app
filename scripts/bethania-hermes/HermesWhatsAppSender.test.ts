import { describe, expect, it } from "bun:test"
import { createHermesWhatsAppSender } from "./HermesWhatsAppSender"

describe("HermesWhatsAppSender", () => {
  it("sends the exact WhatsApp target using the dedicated profile and stdin body", async () => {
    const calls: Array<{ args: string[]; stdin: string }> = []
    const sender = createHermesWhatsAppSender("bethania-local", async (args, stdin) => {
      calls.push({ args, stdin })
    })

    await sender.send("+15551234567", "Agenda de hoje")

    expect(calls).toEqual([
      {
        args: ["-p", "bethania-local", "send", "--to", "whatsapp:15551234567", "--file", "-", "--quiet"],
        stdin: "Agenda de hoje",
      },
    ])
  })

  it("rejects a malformed destination without invoking Hermes", async () => {
    let invoked = false
    const sender = createHermesWhatsAppSender("bethania-local", async () => {
      invoked = true
    })

    await expect(sender.send("123", "Agenda")).rejects.toThrow("E.164")
    expect(invoked).toBe(false)
  })

  it("rejects a blank message", async () => {
    const sender = createHermesWhatsAppSender("bethania-local", async () => {})

    await expect(sender.send("+15551234567", "  ")).rejects.toThrow("mensagem")
  })

  it("rejects an invalid profile before sending", () => {
    expect(() => createHermesWhatsAppSender("not/one")).toThrow("perfil")
  })
})
