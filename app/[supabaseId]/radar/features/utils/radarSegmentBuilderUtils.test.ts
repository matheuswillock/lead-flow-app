import { describe, it, expect } from "bun:test"
import { eventTypePrefixToChannel } from "./radarSegmentBuilderUtils"

describe("eventTypePrefixToChannel", () => {
  it("mapeia prefixos de e-mail para E-mail", () => {
    expect(eventTypePrefixToChannel("email.opened")).toBe("E-mail")
    expect(eventTypePrefixToChannel("email.clicked")).toBe("E-mail")
    expect(eventTypePrefixToChannel("email.bounced")).toBe("E-mail")
  })

  it("mapeia prefixos de whatsapp para WhatsApp", () => {
    expect(eventTypePrefixToChannel("whatsapp.message_received")).toBe("WhatsApp")
    expect(eventTypePrefixToChannel("whatsapp.message_sent")).toBe("WhatsApp")
  })

  it("mapeia prefixos de formulário para Formulário", () => {
    expect(eventTypePrefixToChannel("form.viewed")).toBe("Formulário")
    expect(eventTypePrefixToChannel("form.completed")).toBe("Formulário")
  })

  it("mapeia prefixos de pixel para Pixel", () => {
    expect(eventTypePrefixToChannel("pixel.pageview")).toBe("Pixel")
    expect(eventTypePrefixToChannel("pixel.click")).toBe("Pixel")
  })

  it("mapeia prefixos de lead para CRM", () => {
    expect(eventTypePrefixToChannel("lead.status_changed")).toBe("CRM")
    expect(eventTypePrefixToChannel("lead.milestone.contract_finalized")).toBe("CRM")
  })

  it("mapeia prefixos de portfolio para CRM", () => {
    expect(eventTypePrefixToChannel("portfolio.renewed")).toBe("CRM")
    expect(eventTypePrefixToChannel("portfolio.brokerage_transfer")).toBe("CRM")
  })

  it("mapeia prefixos de profile para CRM", () => {
    expect(eventTypePrefixToChannel("profile.first_contact")).toBe("CRM")
  })

  it("mapeia prefixos desconhecidos para Outros", () => {
    expect(eventTypePrefixToChannel("custom.event")).toBe("Outros")
    expect(eventTypePrefixToChannel("unknown")).toBe("Outros")
  })
})
