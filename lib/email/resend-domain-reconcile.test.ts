import { describe, expect, it } from "bun:test"
import {
  isResendDomainSnapshotInSync,
  isResendDomainStatusInSync,
} from "./resend-domain-reconcile"

describe("isResendDomainStatusInSync", () => {
  it("considera sincronizado quando status é igual", () => {
    expect(isResendDomainStatusInSync("verified", "verified")).toBe(true)
    expect(isResendDomainStatusInSync("partially_failed", "partially_failed")).toBe(true)
  })

  it("detecta dessincronia", () => {
    expect(isResendDomainStatusInSync("verified", "partially_failed")).toBe(false)
    expect(isResendDomainStatusInSync("partially_failed", "verified")).toBe(false)
  })

  it("trata null/undefined como equivalentes", () => {
    expect(isResendDomainStatusInSync(null, undefined)).toBe(true)
    expect(isResendDomainStatusInSync(null, "pending")).toBe(false)
  })
})

describe("isResendDomainSnapshotInSync", () => {
  const basePersisted = {
    resendDomainStatus: "verified",
    resendDomainRegion: "sa-east-1",
    resendOpenTracking: true,
    resendClickTracking: false,
  }

  it("considera sincronizado quando status, região e tracking batem", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: false,
      })
    ).toBe(true)
  })

  it("aceita snake_case do Resend para tracking", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        open_tracking: true,
        click_tracking: false,
      })
    ).toBe(true)
  })

  it("detecta dessincronia de open_tracking com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: false,
        clickTracking: false,
      })
    ).toBe(false)
  })

  it("detecta dessincronia de click_tracking com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: true,
      })
    ).toBe(false)
  })

  it("detecta dessincronia de region com status igual", () => {
    expect(
      isResendDomainSnapshotInSync(basePersisted, {
        status: "verified",
        region: "us-east-1",
        openTracking: true,
        clickTracking: false,
      })
    ).toBe(false)
  })

  it("normaliza region ausente como null e tracking ausente como false", () => {
    expect(
      isResendDomainSnapshotInSync(
        {
          resendDomainStatus: "verified",
          resendDomainRegion: null,
          resendOpenTracking: false,
          resendClickTracking: false,
        },
        { status: "verified" }
      )
    ).toBe(true)
  })

  describe("derivação do DNS de envio", () => {
    // O time real que motivou a mudança: `partially_failed` porque só o CNAME
    // de tracking falhou, com DKIM e SPF verificados desde sempre. Status,
    // região e flags nunca mudam — então antes desta comparação o reconciler
    // dizia "em dia" e nunca derivava o flag, deixando o gate travado até
    // alguém clicar "Verificar DNS" na mão.
    const liberPersistido = {
      resendDomainStatus: "partially_failed",
      resendDomainRegion: "us-east-1",
      resendOpenTracking: false,
      resendClickTracking: false,
      resendSendingDnsVerified: false,
    }
    const liberRemoto = {
      status: "partially_failed",
      region: "us-east-1",
      openTracking: false,
      clickTracking: false,
      records: [
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "Tracking", status: "failed" },
      ],
    }

    it("caso Liber: tudo igual, mas o flag está desatualizado → NÃO está em dia", () => {
      expect(isResendDomainSnapshotInSync(liberPersistido, liberRemoto)).toBe(false)
    })

    it("mesmo caso com o flag já correto → está em dia", () => {
      expect(
        isResendDomainSnapshotInSync(
          { ...liberPersistido, resendSendingDnsVerified: true },
          liberRemoto
        )
      ).toBe(true)
    })

    it("quebra de DNS só nos registros é detectada com status inalterado", () => {
      // O inverso: estava íntegro, o DKIM caiu, o status agregado não mudou.
      expect(
        isResendDomainSnapshotInSync(
          { ...liberPersistido, resendSendingDnsVerified: true },
          {
            ...liberRemoto,
            records: [
              { record: "DKIM", status: "failed" },
              { record: "SPF", status: "verified" },
              { record: "Tracking", status: "failed" },
            ],
          }
        )
      ).toBe(false)
    })

    it("resposta sem records não força reconciliação", () => {
      // Ausência de dado não é evidência de mudança. Se disparasse o sync aqui,
      // todo ciclo do cron reescreveria todos os domínios sem motivo.
      expect(
        isResendDomainSnapshotInSync(
          { ...liberPersistido, resendSendingDnsVerified: true },
          { status: "partially_failed", region: "us-east-1" }
        )
      ).toBe(true)
    })

    it("persistido sem o campo é tratado como false", () => {
      // Linhas anteriores à migration não trazem o campo no tipo opcional.
      const { resendSendingDnsVerified: _omitido, ...semCampo } = liberPersistido
      expect(isResendDomainSnapshotInSync(semCampo, liberRemoto)).toBe(false)
    })
  })
})
