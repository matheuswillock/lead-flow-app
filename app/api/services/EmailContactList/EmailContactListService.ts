import Papa from "papaparse"
import type { IEmailContactListService, ParsedContact } from "./IEmailContactListService"
import { isValidResendRecipientEmail } from "@/lib/email/is-valid-resend-recipient-email"

const EMAIL_COLUMN_ALIASES = ["email", "e-mail", "e_mail", "mail", "email_address"]
const NAME_COLUMN_ALIASES = ["name", "nome", "full_name", "nome_completo", "fullname"]

export class EmailContactListService implements IEmailContactListService {
  parseCsv(csvContent: string): ParsedContact[] {
    const result = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    })

    const headers = result.meta.fields ?? []

    const emailColumn = headers.find((h) => EMAIL_COLUMN_ALIASES.includes(h))
    const nameColumn = headers.find((h) => NAME_COLUMN_ALIASES.includes(h))

    if (!emailColumn) {
      throw new Error("CSV deve conter uma coluna de email (ex: 'email', 'e-mail')")
    }

    const contacts: ParsedContact[] = []

    for (const row of result.data) {
      const rawEmail = row[emailColumn]?.trim()
      if (!rawEmail) continue

      const validation = isValidResendRecipientEmail(rawEmail)
      if (!validation.ok) continue

      const reservedColumns = new Set([emailColumn, nameColumn].filter(Boolean) as string[])
      const customFields: Record<string, string> = {}
      for (const col of headers) {
        if (!reservedColumns.has(col) && row[col] !== undefined && row[col] !== "") {
          customFields[col] = row[col].trim()
        }
      }

      contacts.push({
        email: validation.email,
        name: nameColumn ? row[nameColumn]?.trim() || undefined : undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      })
    }

    return contacts
  }
}

export const emailContactListService = new EmailContactListService()
