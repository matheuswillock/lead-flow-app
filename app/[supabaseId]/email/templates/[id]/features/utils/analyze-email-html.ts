export type EmailHtmlAlertSeverity = "warning" | "info"

export interface EmailHtmlAlert {
  id: string
  severity: EmailHtmlAlertSeverity
  title: string
  message: string
  detail?: string
}

export interface EmailCreationStaticTip {
  id: string
  severity: EmailHtmlAlertSeverity
  title: string
  message: string
  detail?: string
}

const SVG_PATTERN = /<svg[\s>]/gi
const FLEX_LAYOUT_PATTERN = /display\s*:\s*flex/i
const GRID_LAYOUT_PATTERN = /display\s*:\s*grid/i
const ABSOLUTE_POSITION_PATTERN = /position\s*:\s*absolute/i
const GRADIENT_WITHOUT_FALLBACK_PATTERN =
  /background-image\s*:\s*linear-gradient[^;"]*(?![^"]*background-color)/i
const HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/gi
const NO_REPLY_PATTERN = /no[-_]?reply/i

function countSvgTags(html: string): number {
  return html.match(SVG_PATTERN)?.length ?? 0
}

function extractHrefUrls(html: string): string[] {
  const urls: string[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(HREF_PATTERN.source, "gi")
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]?.trim()
    if (href && !href.startsWith("#") && !href.startsWith("mailto:")) {
      urls.push(href)
    }
  }
  return urls
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function analyzeEmailHtml(html: string, sendingDomain?: string | null): EmailHtmlAlert[] {
  const alerts: EmailHtmlAlert[] = []
  const normalized = html.trim()
  if (!normalized) return alerts

  const svgCount = countSvgTags(normalized)
  if (svgCount > 0) {
    alerts.push({
      id: "inline-svg",
      severity: "warning",
      title: "Prefira PNG ou JPG em vez de SVG",
      message:
        "Imagens SVG costumam não ser renderizadas por provedores como Gmail. Use PNG ou JPG hospedadas com a tag de imagem HTML.",
      detail: `Tags SVG encontradas: ${svgCount}`,
    })
  }

  if (NO_REPLY_PATTERN.test(normalized)) {
    alerts.push({
      id: "no-reply-in-content",
      severity: "warning",
      title: "Evite endereços no-reply",
      message:
        "Endereços no-reply indicam comunicação unidirecional e reduzem a confiança do destinatário. Prefira um remetente monitorado.",
      detail: "Referência a no-reply encontrada no conteúdo do template.",
    })
  }

  if (sendingDomain) {
    const sendingHost = sendingDomain.replace(/^@/, "").toLowerCase()
    const mismatched = extractHrefUrls(normalized).filter((url) => {
      const host = getHostname(url)
      if (!host) return false
      return !host.endsWith(sendingHost) && host !== sendingHost
    })

    if (mismatched.length > 0) {
      alerts.push({
        id: "link-domain-mismatch",
        severity: "warning",
        title: "Alinhe os links ao domínio de envio",
        message:
          "URLs muito diferentes do domínio remetente podem acionar filtros de spam. Revise links externos no e-mail.",
        detail: mismatched[0],
      })
    }
  }

  if (GRADIENT_WITHOUT_FALLBACK_PATTERN.test(normalized)) {
    alerts.push({
      id: "gradient-fallback",
      severity: "warning",
      title: "Gradiente sem fallback",
      message:
        "Gradientes têm suporte parcial. Defina também background-color sólido como fallback.",
    })
  }

  if (FLEX_LAYOUT_PATTERN.test(normalized) || GRID_LAYOUT_PATTERN.test(normalized)) {
    alerts.push({
      id: "modern-layout",
      severity: "warning",
      title: "Layout com Flexbox ou Grid",
      message:
        "Flexbox e Grid quebram em vários clientes. Prefira tabelas aninhadas para layout.",
    })
  }

  if (ABSOLUTE_POSITION_PATTERN.test(normalized)) {
    alerts.push({
      id: "absolute-position",
      severity: "warning",
      title: "Posicionamento absoluto",
      message: "position:absolute é ignorado em muitos clientes de e-mail.",
    })
  }

  if (!/<table[\s>]/i.test(normalized)) {
    alerts.push({
      id: "missing-tables",
      severity: "info",
      title: "Estrutura em tabelas",
      message:
        'Use tabelas (<table role="presentation">) como estrutura principal para melhor compatibilidade.',
    })
  }

  return alerts
}

export const EMAIL_CREATION_STATIC_TIPS: EmailCreationStaticTip[] = [
  {
    id: "subdomain-sending",
    severity: "info",
    title: "Use subdomínio do seu domínio para disparos",
    message:
      "Configure o envio por um subdomínio dedicado (ex.: email.suaempresa.com.br) com SPF, DKIM e DMARC. Isso melhora a entregabilidade e reduz risco de spam.",
    detail: "Ex.: marketing@email.suaempresa.com.br",
  },
  {
    id: "no-reply-sender",
    severity: "warning",
    title: "Não use no-reply como remetente",
    message:
      "Remetentes no-reply sinalizam comunicação unidirecional e diminuem a confiança da caixa de entrada. Use um endereço monitorado (ex.: contato@...).",
    detail: "Evite: Corretor Studio <no-reply@seudominio.com>",
  },
  {
    id: "image-formats",
    severity: "info",
    title: "Prefira PNG ou JPG para imagens",
    message:
      "SVG e formatos vetoriais embutidos podem não aparecer no Gmail e em outros clientes. Hospede PNG ou JPG e referencie com largura, altura e texto alternativo.",
  },
  {
    id: "inline-styles",
    severity: "info",
    title: "Estilos inline",
    message:
      'Aplique estilos inline (style="...") em cada elemento; não dependa apenas de blocos <style>.',
  },
  {
    id: "max-width",
    severity: "info",
    title: "Largura e imagens",
    message:
      "Mantenha largura máxima de ~600px e imagens com width explícito para renderização consistente.",
  },
  {
    id: "test-before-send",
    severity: "info",
    title: "Teste antes de disparar",
    message: "Envie um e-mail de teste antes de disparar campanhas em massa.",
  },
]

/** @deprecated Use EMAIL_CREATION_STATIC_TIPS */
export const EMAIL_CREATION_TIPS = EMAIL_CREATION_STATIC_TIPS.map((tip) => tip.message) as readonly string[]
