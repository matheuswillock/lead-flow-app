/**
 * Escape de texto para valores TEXT do formato iCalendar (RFC 5545 §3.3.11).
 *
 * SPEC 13 (Agenda na Criação de Lead), estágio A-E1b: a quebra de linha `\r`
 * sozinha (sem `\n` na sequência) não era escapada — só `\n` virava `\n`
 * literal. Um `\r` cru dentro de um valor TEXT pode ser interpretado por
 * alguns parsers de .ics como o fim de uma linha "dobrada" (RFC 5545 usa
 * CRLF para dobra de linha), abrindo espaço para injetar uma propriedade
 * nova no arquivo (ex.: uma segunda `DESCRIPTION:` ou um `ATTENDEE:` extra)
 * a partir de um campo como nome do lead ou notas da reunião.
 */
export function escapeIcsText(value?: string | null): string {
  if (!value) return ""
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}
