/**
 * Aviso da entrevista da administradora para o cliente, enviado do WhatsApp do próprio usuário.
 * O link `wa.me` abre o app no celular e o WhatsApp Web no computador, com a mensagem preenchida.
 *
 * A data vai na mensagem exatamente como o usuário digitou (`"2026-11-12T14:30"`), sem conversão de fuso.
 */

export type InterviewMessageInput = {
  clientName: string
  /** Data/hora local digitada no card: "AAAA-MM-DDTHH:mm". */
  scheduledLocal: string
  administratorName?: string | null
  notes?: string | null
  brokerName?: string | null
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ""
}

/** "quinta-feira, 12/11, às 14:30" a partir do horário digitado, sem aplicar fuso. */
export function formatInterviewLocal(scheduledLocal: string): string {
  const match = LOCAL_PATTERN.exec(scheduledLocal)
  if (!match) return scheduledLocal
  const [, year, month, day, hour, minute] = match
  const asUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(asUtc)
  return `${weekday}, ${day}/${month}, às ${hour}:${minute}`
}

export function buildInterviewMessage(input: InterviewMessageInput): string {
  const greeting = firstName(input.clientName) ? `Olá, ${firstName(input.clientName)}!` : "Olá!"
  const administrator = input.administratorName?.trim()
    ? `a administradora ${input.administratorName.trim()}`
    : "a administradora"

  const lines = [
    greeting,
    "",
    `Seu contrato e seus documentos já foram enviados. Agora ${administrator} vai fazer uma entrevista rápida com você para confirmar seus dados.`,
    "",
    `📅 ${formatInterviewLocal(input.scheduledLocal)}`,
  ]

  const notes = input.notes?.trim()
  if (notes) lines.push("", notes)

  lines.push("", "Fique atento(a) às ligações nesse horário. Qualquer dúvida, é só me chamar por aqui.")

  const broker = input.brokerName?.trim()
  if (broker) lines.push("", broker)

  return lines.join("\n")
}

/** Telefone só com dígitos e DDI; números brasileiros sem DDI ganham o 55. `null` quando não dá para usar. */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
