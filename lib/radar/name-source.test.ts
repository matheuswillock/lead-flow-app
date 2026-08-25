import { describe, expect, it } from "bun:test"
import {
  getRadarNameSourceRank,
  radarNameSourceFromWhatsapp,
  resolveRadarName,
} from "@/lib/radar/name-source"

const curated = {
  displayName: "João Pedro Almeida",
  normalizedName: "joao pedro almeida",
  nameSource: "crm",
}

describe("resolveRadarName", () => {
  it("barra fonte mais fraca — push name não derruba nome do CRM", () => {
    expect(
      resolveRadarName(curated, {
        displayName: "Jhow 🔥",
        normalizedName: "jhow",
        source: "whatsapp",
      })
    ).toBeNull()
  })

  it("aceita fonte mais forte — CRM sobre push name", () => {
    expect(
      resolveRadarName(
        { displayName: "Jhow 🔥", normalizedName: "jhow", nameSource: "whatsapp" },
        { displayName: "João Pedro Almeida", normalizedName: "joao pedro almeida", source: "crm" }
      )
    ).toEqual({
      displayName: "João Pedro Almeida",
      normalizedName: "joao pedro almeida",
      nameSource: "crm",
    })
  })

  it("aceita a MESMA fonte — é a correção de nome que motivou o achado #7", () => {
    expect(
      resolveRadarName(curated, {
        displayName: "João Pedro de Almeida",
        normalizedName: "joao pedro de almeida",
        source: "crm",
      })
    ).toEqual({
      displayName: "João Pedro de Almeida",
      normalizedName: "joao pedro de almeida",
      nameSource: "crm",
    })
  })

  it("nome vazio ou só espaço nunca apaga o que existe", () => {
    expect(resolveRadarName(curated, { displayName: "", normalizedName: "", source: "crm" })).toBeNull()
    expect(
      resolveRadarName(curated, { displayName: "   ", normalizedName: "", source: "manual" })
    ).toBeNull()
  })

  it("perfil sem nome usável aceita qualquer origem", () => {
    expect(
      resolveRadarName(
        { displayName: "", normalizedName: "", nameSource: "manual" },
        { displayName: "Maria S.", normalizedName: "maria s", source: "whatsapp" }
      )
    ).toEqual({ displayName: "Maria S.", normalizedName: "maria s", nameSource: "whatsapp" })
  })

  it("nome e fonte idênticos não geram escrita", () => {
    expect(
      resolveRadarName(curated, {
        displayName: "  João Pedro Almeida  ",
        normalizedName: "joao pedro almeida",
        source: "crm",
      })
    ).toBeNull()
  })

  it("apara o nome antes de gravar", () => {
    expect(
      resolveRadarName(
        { displayName: null, normalizedName: null, nameSource: null },
        { displayName: "  Ana  ", normalizedName: "ana", source: "crm" }
      )?.displayName
    ).toBe("Ana")
  })

  it("fonte desconhecida é o piso — não protege nada e não bloqueia nada", () => {
    expect(getRadarNameSourceRank("fonte-que-nao-existe")).toBe(0)
    expect(getRadarNameSourceRank(null)).toBe(0)

    // Legado (nameSource nulo) aceita escrita...
    expect(
      resolveRadarName(
        { displayName: "Antigo", normalizedName: "antigo", nameSource: null },
        { displayName: "Novo", normalizedName: "novo", source: "whatsapp" }
      )
    ).not.toBeNull()

    // ...mas uma fonte desconhecida não vence uma conhecida.
    expect(
      resolveRadarName(curated, {
        displayName: "Novo",
        normalizedName: "novo",
        source: "fonte-que-nao-existe",
      })
    ).toBeNull()
  })
})

describe("ranking entre fontes", () => {
  it("manual > crm > carteira/import/formulário > e-mail/agenda > push name", () => {
    const ranks = [
      getRadarNameSourceRank("manual"),
      getRadarNameSourceRank("crm"),
      getRadarNameSourceRank("portfolio"),
      getRadarNameSourceRank("email"),
      getRadarNameSourceRank("whatsapp"),
    ]
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a))
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it("contrato finalizado empata com CRM — os dois são cadastro curado", () => {
    expect(getRadarNameSourceRank("lead_finalized")).toBe(getRadarNameSourceRank("crm"))
  })
})

describe("radarNameSourceFromWhatsapp", () => {
  it("preserva a procedência que o inbox já registra", () => {
    expect(radarNameSourceFromWhatsapp("MANUAL")).toBe("manual")
    expect(radarNameSourceFromWhatsapp("LEAD")).toBe("crm")
    expect(radarNameSourceFromWhatsapp("PHONE_BOOK")).toBe("whatsapp_phone_book")
  })

  it("push name, número e valor desconhecido caem no piso do WhatsApp", () => {
    expect(radarNameSourceFromWhatsapp("PUSH_NAME")).toBe("whatsapp")
    expect(radarNameSourceFromWhatsapp("PHONE_NUMBER")).toBe("whatsapp")
    expect(radarNameSourceFromWhatsapp(null)).toBe("whatsapp")
    expect(radarNameSourceFromWhatsapp("ALGO_NOVO")).toBe("whatsapp")
  })
})
