import Papa from "papaparse"
import type {
  IEmailContactListService,
  ParsedContact,
  ParsedCsvIssue,
  ParsedCsvWithIssues,
} from "./IEmailContactListService"
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"

const EMAIL_COLUMN_ALIASES = ["email", "e-mail", "e_mail", "mail", "email_address"]
const NAME_COLUMN_ALIASES = ["name", "nome", "full_name", "nome_completo", "fullname"]

/** Com `header: true`, a linha 1 do arquivo é o cabeçalho; dados começam na 2. */
const CSV_FIRST_DATA_LINE = 2

export class EmailContactListService implements IEmailContactListService {
  /**
   * Parser SEM porta de descarte: linha com célula de e-mail vazia vira
   * `issue` (linha real do arquivo + motivo) e linha com e-mail preenchido
   * vira contato — mesmo com sintaxe inválida. Validar audiência é papel do
   * gate de importação (`collectAudienceValidRows`), que classifica e reporta
   * cada recusa; o parser descartando antes escondia linhas do relatório
   * (drop silencioso corrigido nesta versão).
   */
  parseCsvWithIssues(csvContent: string): ParsedCsvWithIssues {
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

    const parsed: ParsedCsvWithIssues = { contacts: [], issues: [] }

    result.data.forEach((row, rowIndex) => {
      const line = rowIndex + CSV_FIRST_DATA_LINE
      const rawEmail = row[emailColumn]?.trim()
      if (!rawEmail) {
        const issue: ParsedCsvIssue = {
          line,
          email: "(vazio)",
          reason: "E-mail ausente na linha",
        }
        parsed.issues.push(issue)
        return
      }

      const reservedColumns = new Set([emailColumn, nameColumn].filter(Boolean) as string[])
      const customFields: Record<string, string> = {}
      for (const col of headers) {
        if (!reservedColumns.has(col) && row[col] !== undefined && row[col] !== "") {
          customFields[col] = row[col].trim()
        }
      }

      parsed.contacts.push({
        line,
        email: rawEmail,
        name: nameColumn ? row[nameColumn]?.trim() || undefined : undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      })
    })

    return parsed
  }

  /**
   * Contrato legado (preview/import direto): devolve só contatos que passam na
   * pré-validação de audiência, com e-mail normalizado — comportamento
   * idêntico ao anterior à correção do drop silencioso.
   */
  parseCsv(csvContent: string): ParsedContact[] {
    const { contacts } = this.parseCsvWithIssues(csvContent)

    const validContacts: ParsedContact[] = []
    for (const contact of contacts) {
      const validation = evaluateEmailForAudience(contact.email)
      if (!validation.ok) continue
      validContacts.push({
        email: validation.email,
        name: contact.name,
        customFields: contact.customFields,
      })
    }
    return validContacts
  }
}

export const emailContactListService = new EmailContactListService()
