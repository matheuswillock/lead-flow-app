import { describe, expect, it } from "bun:test"
import { deriveSendingDnsVerified, isSendingDnsRecord } from "./resend-domain-records"

describe("isSendingDnsRecord", () => {
  it("reconhece os registros que entregam e-mail", () => {
    expect(isSendingDnsRecord("DKIM")).toBe(true)
    expect(isSendingDnsRecord("SPF")).toBe(true)
    expect(isSendingDnsRecord(" DKIM ")).toBe(true)
  })

  it("não reconhece métrica, recebimento, rótulo novo ou ausente", () => {
    // `Receiving` é inbound e opt-in; `Tracking` alimenta o pixel de abertura.
    // Nenhum dos dois assina o e-mail que sai.
    expect(isSendingDnsRecord("Tracking")).toBe(false)
    expect(isSendingDnsRecord("TrackingCAA")).toBe(false)
    expect(isSendingDnsRecord("Receiving")).toBe(false)
    expect(isSendingDnsRecord("AlgoQueOResendCriarDepois")).toBe(false)
    expect(isSendingDnsRecord(null)).toBe(false)
    expect(isSendingDnsRecord(undefined)).toBe(false)
    expect(isSendingDnsRecord("")).toBe(false)
  })
})

describe("deriveSendingDnsVerified", () => {
  it("caso Liber: DKIM e SPF verificados, tracking falhou → envio ok", () => {
    expect(
      deriveSendingDnsVerified([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "Tracking", status: "failed" },
      ])
    ).toBe(true)
  })

  it("DKIM quebrado bloqueia, mesmo com o tracking verificado", () => {
    // O caso que "aceitar partially_failed em bloco" deixaria passar, e o
    // e-mail sairia sem assinatura.
    expect(
      deriveSendingDnsVerified([
        { record: "DKIM", status: "failed" },
        { record: "SPF", status: "verified" },
        { record: "Tracking", status: "verified" },
      ])
    ).toBe(false)
  })

  it("SPF pendente bloqueia", () => {
    expect(
      deriveSendingDnsVerified([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "pending" },
      ])
    ).toBe(false)
  })

  it("Receiving pendente NÃO bloqueia quem tem DKIM e SPF ok", () => {
    // Regressão do desenho anterior por denylist, em que `Receiving` entrava na
    // conta de envio e um registro de inbound pendente travava a campanha.
    expect(
      deriveSendingDnsVerified([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "Receiving", status: "pending" },
      ])
    ).toBe(true)
  })

  it("rótulo que o Resend venha a criar não vira pré-requisito de envio", () => {
    expect(
      deriveSendingDnsVerified([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "RotuloNovoDoFuturo", status: "failed" },
      ])
    ).toBe(true)
  })

  it("não sabe responder sem registros", () => {
    expect(deriveSendingDnsVerified([])).toBeUndefined()
    expect(deriveSendingDnsVerified(null)).toBeUndefined()
    expect(deriveSendingDnsVerified(undefined)).toBeUndefined()
  })

  it("não sabe responder quando nenhum item traz rótulo", () => {
    // O payload do webhook `domain.updated` nem sempre traz `record`. Responder
    // `false` aqui gravaria "DNS quebrado" a cada evento enxuto do provedor e
    // re-bloquearia os times que este código destrava.
    expect(deriveSendingDnsVerified([{ status: "verified" }, { status: "failed" }])).toBeUndefined()
  })

  describe("snapshot parcial não conclui nada", () => {
    // Sem exigir os dois propósitos, o filtro descartava o item incompleto e o
    // registro restante respondia sozinho. Medido antes da correção: os três
    // casos abaixo devolviam `true` e liberavam disparo.

    it("DKIM verificado com SPF sem rótulo não libera", () => {
      expect(
        deriveSendingDnsVerified([{ record: "DKIM", status: "verified" }, { status: "pending" }])
      ).toBeUndefined()
    })

    it("DKIM verificado com SPF omitido não libera", () => {
      expect(deriveSendingDnsVerified([{ record: "DKIM", status: "verified" }])).toBeUndefined()
    })

    it("SPF verificado sem DKIM nenhum não libera", () => {
      // O pior dos três: liberaria e-mail saindo sem assinatura.
      expect(deriveSendingDnsVerified([{ record: "SPF", status: "verified" }])).toBeUndefined()
    })

    it("quebra conhecida bloqueia mesmo em snapshot incompleto", () => {
      // Contrapeso da regra acima. Exigir os dois propósitos ANTES de olhar o
      // status transformaria estes casos em `undefined`, e `undefined` preserva
      // o valor antigo: um DKIM quebrado deixaria de derrubar um domínio já
      // liberado. Quebra vista é conclusiva; ausência é que não é.
      expect(deriveSendingDnsVerified([{ record: "DKIM", status: "failed" }])).toBe(false)
      expect(deriveSendingDnsVerified([{ record: "SPF", status: "failed" }])).toBe(false)
      expect(
        deriveSendingDnsVerified([{ record: "DKIM", status: "failed" }, { status: "verified" }])
      ).toBe(false)
    })

    it("com os dois presentes volta a decidir normalmente", () => {
      expect(
        deriveSendingDnsVerified([
          { record: "DKIM", status: "verified" },
          { record: "SPF", status: "pending" },
        ])
      ).toBe(false)
    })
  })

  describe("domínios reais bloqueados hoje continuam destravados", () => {
    // Consultados na API do Resend. Se algum dia estes dois casos deixarem de
    // devolver `true`, a correção que causou isso re-bloqueou dois clientes.
    const tracking = { record: "Tracking", status: "failed" }
    const dkimESpfOk = [
      { record: "DKIM", status: "verified" },
      { record: "SPF", status: "verified" },
      { record: "SPF", status: "verified" },
    ]

    it("mail.libercorretora.com.br", () => {
      expect(deriveSendingDnsVerified([...dkimESpfOk, tracking])).toBe(true)
    })

    it("perttoconsultoria.com.br", () => {
      expect(deriveSendingDnsVerified([...dkimESpfOk, tracking])).toBe(true)
    })
  })

  it("não sabe responder quando só há tracking ou recebimento", () => {
    expect(
      deriveSendingDnsVerified([
        { record: "Tracking", status: "verified" },
        { record: "Receiving", status: "verified" },
      ])
    ).toBeUndefined()
  })

  it("nenhum rótulo desconhecido consegue LIBERAR sozinho", () => {
    // A assimetria que sustenta o desenho: ignorar o desconhecido nunca produz
    // `true` — liberar exige DKIM/SPF explicitamente verificados.
    expect(deriveSendingDnsVerified([{ record: "QualquerCoisa", status: "verified" }])).toBeUndefined()
  })
})
