export type EmailHtmlAlertSeverity = "warning" | "info"

export interface EmailHtmlAlert {
  id: string
  severity: EmailHtmlAlertSeverity
  message: string
}

const SVG_PATTERN = /<svg[\s>]/i
const FLEX_LAYOUT_PATTERN = /display\s*:\s*flex/i
const GRID_LAYOUT_PATTERN = /display\s*:\s*grid/i
const ABSOLUTE_POSITION_PATTERN = /position\s*:\s*absolute/i
const GRADIENT_WITHOUT_FALLBACK_PATTERN =
  /background-image\s*:\s*linear-gradient[^;"]*(?![^"]*background-color)/i

export function analyzeEmailHtml(html: string): EmailHtmlAlert[] {
  const alerts: EmailHtmlAlert[] = []
  const normalized = html.trim()
  if (!normalized) return alerts

  if (SVG_PATTERN.test(normalized)) {
    alerts.push({
      id: "inline-svg",
      severity: "warning",
      message:
        "Ícones SVG não funcionam na maioria dos clientes de e-mail. Use imagens hospedadas (PNG) ou texto.",
    })
  }

  if (GRADIENT_WITHOUT_FALLBACK_PATTERN.test(normalized)) {
    alerts.push({
      id: "gradient-fallback",
      severity: "warning",
      message:
        "Gradientes têm suporte parcial. Defina também background-color sólido como fallback.",
    })
  }

  if (FLEX_LAYOUT_PATTERN.test(normalized) || GRID_LAYOUT_PATTERN.test(normalized)) {
    alerts.push({
      id: "modern-layout",
      severity: "warning",
      message:
        "Flexbox e Grid quebram em vários clientes. Prefira tabelas aninhadas para layout.",
    })
  }

  if (ABSOLUTE_POSITION_PATTERN.test(normalized)) {
    alerts.push({
      id: "absolute-position",
      severity: "warning",
      message: "position:absolute é ignorado em muitos clientes de e-mail.",
    })
  }

  if (!/<table[\s>]/i.test(normalized)) {
    alerts.push({
      id: "missing-tables",
      severity: "info",
      message:
        "Use tabelas (<table role=\"presentation\">) como estrutura principal para melhor compatibilidade.",
    })
  }

  return alerts
}

export const EMAIL_CREATION_TIPS = [
  "Use tabelas (<table role=\"presentation\">) para organizar o layout — é o padrão mais compatível.",
  "Aplique estilos inline (style=\"...\") em cada elemento; não dependa apenas de <style>.",
  "Substitua SVG por <img src=\"https://...\" width height alt> com imagem hospedada.",
  "Defina background-color sólido antes de gradientes em células e botões.",
  "Mantenha largura máxima de ~600px e imagens com width explícito.",
  "Envie um e-mail de teste antes de disparar campanhas em massa.",
] as const
