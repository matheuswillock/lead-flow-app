import { describe, expect, it, mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE,
  RESEND_DOMAIN_METRICS_DISABLED_MESSAGE,
} from "@/lib/email/campaign-dispatch-guards"

// `useParams` só decide o href do botão; fixar evita depender do router em SSR.
mock.module("next/navigation", () => ({
  useParams: () => ({ supabaseId: "team-1" }),
}))

const { TrackingDegradedAlert } = await import("./TrackingDegradedAlert")

/**
 * O título deste alerta afirmava bloqueio para qualquer aviso.
 *
 * Isso era verdade enquanto `getResendDomainDispatchWarnings` só devolvia algo
 * quando o gate travava. Depois que aviso deixou de implicar bloqueio, o time
 * cujo DNS de envio está íntegro passou a ler "Disparo bloqueado" logo acima de
 * um corpo dizendo "suas campanhas disparam normalmente" — e ao lado de um botão
 * de disparo habilitado. É o time que o gate existe para destravar sendo
 * informado, na tela principal, de que continua travado.
 */
describe("TrackingDegradedAlert", () => {
  it("caso Liber: dispara sem medir → título fala de métrica, não de bloqueio", () => {
    const html = renderToStaticMarkup(
      <TrackingDegradedAlert
        warnings={[RESEND_DOMAIN_METRICS_DISABLED_MESSAGE]}
        blocked={false}
      />
    )
    expect(html).toContain("Métricas de abertura indisponíveis")
    expect(html).not.toContain("Disparo bloqueado")
    expect(html).toContain("disparam normalmente")
  })

  it("DNS de envio quebrado → título afirma o bloqueio", () => {
    const html = renderToStaticMarkup(
      <TrackingDegradedAlert
        warnings={[RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE]}
        blocked
      />
    )
    expect(html).toContain("Disparo bloqueado")
    expect(html).toContain("DNS de envio")
  })

  it("sem a prop, não inventa bloqueio", () => {
    // Default seguro: um consumidor que esqueça de passar `blocked` degrada para
    // a mensagem branda, não para uma acusação falsa de bloqueio.
    const html = renderToStaticMarkup(
      <TrackingDegradedAlert warnings={[RESEND_DOMAIN_METRICS_DISABLED_MESSAGE]} />
    )
    expect(html).toContain("Métricas de abertura indisponíveis")
    expect(html).not.toContain("Disparo bloqueado")
  })

  it("sem avisos não renderiza nada", () => {
    expect(renderToStaticMarkup(<TrackingDegradedAlert warnings={[]} />)).toBe("")
    expect(renderToStaticMarkup(<TrackingDegradedAlert warnings={null} />)).toBe("")
  })
})
