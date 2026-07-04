export const WHATSAPP_TAG_COLOR_TOKENS = [
  "primary",
  "secondary",
  "destructive",
  "accent",
  "muted",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const

export type WhatsAppTagColorToken = (typeof WHATSAPP_TAG_COLOR_TOKENS)[number]

export function isWhatsAppTagColorToken(value: string): value is WhatsAppTagColorToken {
  return (WHATSAPP_TAG_COLOR_TOKENS as readonly string[]).includes(value)
}

export function whatsAppTagBadgeClassName(color: string): string {
  switch (color) {
    case "primary":
      return "bg-primary/15 text-primary border-primary/20"
    case "secondary":
      return "bg-secondary text-secondary-foreground"
    case "destructive":
      return "bg-destructive/15 text-destructive border-destructive/20"
    case "accent":
      return "bg-accent text-accent-foreground"
    case "muted":
      return "bg-muted text-muted-foreground"
    case "chart-1":
      return "bg-chart-1/15 text-chart-1 border-chart-1/20"
    case "chart-2":
      return "bg-chart-2/15 text-chart-2 border-chart-2/20"
    case "chart-3":
      return "bg-chart-3/15 text-chart-3 border-chart-3/20"
    case "chart-4":
      return "bg-chart-4/15 text-chart-4 border-chart-4/20"
    case "chart-5":
      return "bg-chart-5/15 text-chart-5 border-chart-5/20"
    default:
      return "bg-muted text-muted-foreground"
  }
}
