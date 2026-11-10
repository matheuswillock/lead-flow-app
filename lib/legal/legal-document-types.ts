/** Versão vigente dos documentos que o cliente aceita antes de contratar (data da última atualização). */
export const LEGAL_DOCUMENTS_VERSION = "2026-08-27"

export type LegalSegment = {
  text: string
  bold?: boolean
}

export type LegalBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; segments: LegalSegment[] }
  | { type: "ul"; items: LegalSegment[][] }

export type LegalDocument = {
  title: string
  updatedAt: string | null
  blocks: LegalBlock[]
}
