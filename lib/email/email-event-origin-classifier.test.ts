import { describe, expect, it } from "bun:test"
import {
  APPLE_MPP_IPV4_CIDRS,
  GMAIL_FETCHER_FOSSIL_CHROME_UA_MARKER,
  GMAIL_IMAGE_PROXY_UA_MARKERS,
  GOOGLE_PROXY_IPV4_CIDRS,
  KNOWN_SCANNER_UA_MARKERS,
  PREFETCH_DELIVERY_DELTA_MAX_SECONDS,
  classifyEmailEventOrigin,
  isIpv4InAnyCidr,
  readEmailEventOrigin,
  reinforceOriginWithDeliveryDelta,
} from "./email-event-origin-classifier"

/**
 * Fixtures REAIS, não inventadas:
 * - UA duplicado do fetcher do Gmail: observado em produção (17/09) nos
 *   payloads do Resend vindos de 74.125.x — o texto inteiro aparece DUAS vezes.
 * - `MSOffice 16` e `Chrome/153` são payloads reais de email.opened capturados
 *   do webhook em 17/09/2026 (destinatários corporativos brasileiros).
 */
const GMAIL_FETCHER_DUPLICATED_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246"

const GMAIL_LEGACY_PROXY_UA =
  "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)"

const OUTLOOK_DESKTOP_UA = "Mozilla/4.0 (compatible; ms-office; MSOffice 16)"

const HUMAN_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"

const DELIVERED_AT = new Date("2026-09-17T16:04:00.000Z")
const OPENED_LATE = new Date("2026-09-17T17:39:13.477Z") // ~95min após entrega
const OPENED_FAST = new Date("2026-09-17T16:04:30.000Z") // 30s após entrega

describe("classifyEmailEventOrigin — regras de user-agent", () => {
  it("UA duplicado do fetcher do Gmail (Chrome/42 fóssil) é bot/gmail-proxy mesmo com IP fora das faixas", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: GMAIL_FETCHER_DUPLICATED_UA,
      ipAddress: "187.104.124.17",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("gmail-proxy")
    expect(origin.uaFamily).toBe("gmail-image-proxy")
  })

  it("UA legado com ggpht.com GoogleImageProxy é bot/gmail-proxy", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: GMAIL_LEGACY_PROXY_UA,
      ipAddress: null,
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("gmail-proxy")
  })

  it("UA de scanner corporativo conhecido é bot/scanner", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Barracuda Sentinel (EE)",
      ipAddress: "200.10.10.10",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("scanner")
  })
})

describe("classifyEmailEventOrigin — faixas de IP em memória", () => {
  it("IP do image proxy do Google (74.125.0.0/16) com UA genérico é bot/gmail-proxy", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: "Mozilla/5.0",
      ipAddress: "74.125.208.10",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("gmail-proxy")
  })

  it("IP da Apple (17.0.0.0/8) com UA genérico é bot/apple-mpp (Mail Privacy Protection)", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: "Mozilla/5.0",
      ipAddress: "17.58.98.7",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("apple-mpp")
  })

  it("IPv6 não casa com as faixas IPv4 — segue para as demais regras", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: HUMAN_CHROME_UA,
      ipAddress: "2804:2894:c100:a47d:1405:5c99:6282:fba1",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("human")
    expect(origin.uaFamily).toBe("chrome")
  })
})

describe("classifyEmailEventOrigin — reforço por delta entrega→abertura", () => {
  it(`open <${PREFETCH_DELIVERY_DELTA_MAX_SECONDS}s após a entrega sem match de UA/IP vira bot/generic`, () => {
    const origin = classifyEmailEventOrigin({
      userAgent: HUMAN_CHROME_UA,
      ipAddress: "200.10.10.10",
      occurredAt: OPENED_FAST,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("generic")
  })

  it("open ANTES da entrega registrada (delta negativo) também é bot/generic", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: HUMAN_CHROME_UA,
      ipAddress: "200.10.10.10",
      occurredAt: new Date(DELIVERED_AT.getTime() - 5_000),
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("generic")
  })

  it("sem deliveredAt o delta não reforça nada — UA real vira human", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: HUMAN_CHROME_UA,
      ipAddress: "200.10.10.10",
      occurredAt: OPENED_LATE,
      deliveredAt: null,
    })
    expect(origin.classification).toBe("human")
  })
})

describe("classifyEmailEventOrigin — destinatários reais (fixtures de produção 17/09)", () => {
  it("Outlook desktop (MSOffice 16) abrindo 95min após a entrega é human/outlook", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: OUTLOOK_DESKTOP_UA,
      ipAddress: "187.104.124.17",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("human")
    expect(origin.botSource).toBeUndefined()
    expect(origin.uaFamily).toBe("outlook")
  })

  it("Chrome 153 real abrindo 95min após a entrega é human/chrome", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: HUMAN_CHROME_UA,
      ipAddress: "187.20.30.40",
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("human")
    expect(origin.uaFamily).toBe("chrome")
  })
})

describe("classifyEmailEventOrigin — sem sinal", () => {
  it("sem UA, sem IP e sem delta rápido é unknown", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: null,
      ipAddress: null,
      occurredAt: OPENED_LATE,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("unknown")
    expect(origin.botSource).toBeUndefined()
    expect(origin.uaFamily).toBeUndefined()
  })

  it("sem UA e sem IP mas com delta rápido é bot/generic", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: null,
      ipAddress: null,
      occurredAt: OPENED_FAST,
      deliveredAt: DELIVERED_AT,
    })
    expect(origin.classification).toBe("bot")
    expect(origin.botSource).toBe("generic")
  })
})

describe("classifyEmailEventOrigin — LGPD: IP nunca vaza para o resultado", () => {
  it("o objeto retornado não contém o IP em nenhuma chave", () => {
    const origin = classifyEmailEventOrigin({
      userAgent: GMAIL_FETCHER_DUPLICATED_UA,
      ipAddress: "74.125.208.10",
      occurredAt: OPENED_FAST,
      deliveredAt: DELIVERED_AT,
    })
    expect(JSON.stringify(origin)).not.toContain("74.125.208.10")
    expect(Object.keys(origin).sort()).toEqual(["botSource", "classification", "uaFamily"].sort())
  })
})

describe("isIpv4InAnyCidr — matcher em memória", () => {
  it("cobre bordas das faixas do Google e da Apple", () => {
    expect(isIpv4InAnyCidr("74.125.0.0", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("74.125.255.255", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("74.126.0.0", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("66.102.15.255", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("66.102.16.0", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("66.249.64.1", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("66.249.96.0", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("209.85.128.0", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("209.85.255.255", GOOGLE_PROXY_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("209.85.127.255", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("17.0.0.1", APPLE_MPP_IPV4_CIDRS)).toBe(true)
    expect(isIpv4InAnyCidr("18.0.0.1", APPLE_MPP_IPV4_CIDRS)).toBe(false)
  })

  it("entrada inválida ou IPv6 devolve false sem lançar", () => {
    expect(isIpv4InAnyCidr("999.1.1.1", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("2607:f8b0::1", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr("", GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
    expect(isIpv4InAnyCidr(null, GOOGLE_PROXY_IPV4_CIDRS)).toBe(false)
  })
})

describe("reinforceOriginWithDeliveryDelta — reforço aplicado depois, no dreno do órfão", () => {
  const deliveredAt = new Date("2026-09-17T16:04:00.000Z")

  it("rebaixa human para bot/generic quando o evento cai dentro da janela de pré-fetch", () => {
    const reinforced = reinforceOriginWithDeliveryDelta(
      { classification: "human", uaFamily: "chrome" },
      { occurredAt: new Date("2026-09-17T16:04:05.000Z"), deliveredAt }
    )

    expect(reinforced.classification).toBe("bot")
    expect(reinforced.botSource).toBe("generic")
    expect(reinforced.uaFamily).toBe("chrome")
  })

  it("mantém human quando o evento está fora da janela", () => {
    const reinforced = reinforceOriginWithDeliveryDelta(
      { classification: "human", uaFamily: "outlook" },
      { occurredAt: new Date("2026-09-17T17:39:13.000Z"), deliveredAt }
    )

    expect(reinforced.classification).toBe("human")
  })

  it("sem entrega conhecida não há delta: a classificação passa intacta", () => {
    const reinforced = reinforceOriginWithDeliveryDelta(
      { classification: "unknown" },
      { occurredAt: new Date("2026-09-17T16:04:01.000Z"), deliveredAt: null }
    )

    expect(reinforced.classification).toBe("unknown")
  })

  it("nunca promove: bot por UA/IP continua com o botSource específico", () => {
    const reinforced = reinforceOriginWithDeliveryDelta(
      { classification: "bot", botSource: "gmail-proxy", uaFamily: "gmail-image-proxy" },
      { occurredAt: new Date("2026-09-17T19:00:00.000Z"), deliveredAt }
    )

    expect(reinforced.botSource).toBe("gmail-proxy")
  })
})

describe("readEmailEventOrigin — rótulo de heurística retroativa", () => {
  it("preserva `estimated` do backfill histórico", () => {
    // O backfill grava `'estimated', true` quando inferiu `bot` por delta de
    // tempo. Descartar a chave faria a inferência parecer tão firme quanto a
    // identificação por user-agent do proxy.
    const origin = readEmailEventOrigin({
      origin: { classification: "bot", botSource: "generic", estimated: true },
    })

    expect(origin?.classification).toBe("bot")
    expect(origin?.estimated).toBe(true)
  })

  it("não inventa `estimated` em evento classificado ao vivo", () => {
    const origin = readEmailEventOrigin({
      origin: { classification: "bot", botSource: "gmail-proxy", uaFamily: "gmail-image-proxy" },
    })

    expect(origin?.botSource).toBe("gmail-proxy")
    expect(origin?.estimated).toBeUndefined()
  })

  it("ignora `estimated` que não seja booleano verdadeiro", () => {
    const origin = readEmailEventOrigin({
      origin: { classification: "human", estimated: "sim" },
    })

    expect(origin?.estimated).toBeUndefined()
  })
})

describe("constantes nomeadas — reviravel sem ler a implementação", () => {
  it("marcadores e faixas batem com a decisão registrada", () => {
    expect(GMAIL_IMAGE_PROXY_UA_MARKERS).toContain("googleimageproxy")
    expect(GMAIL_IMAGE_PROXY_UA_MARKERS).toContain("ggpht.com")
    expect(GMAIL_FETCHER_FOSSIL_CHROME_UA_MARKER).toBe("chrome/42.0.2311.135")
    expect(KNOWN_SCANNER_UA_MARKERS.length).toBeGreaterThan(5)
    expect(GOOGLE_PROXY_IPV4_CIDRS).toEqual([
      "74.125.0.0/16",
      "66.102.0.0/20",
      "66.249.64.0/19",
      "209.85.128.0/17",
    ])
    expect(APPLE_MPP_IPV4_CIDRS).toEqual(["17.0.0.0/8"])
    expect(PREFETCH_DELIVERY_DELTA_MAX_SECONDS).toBe(120)
  })
})
