import { FORM_PRIVACY_POLICY_TEMPLATE } from "./form-privacy-policy-template"
import type { LegalBlock, LegalSegment } from "./legal-document-types"

/** Data da última atualização do modelo de política exibido nos formulários. */
export const FORM_PRIVACY_POLICY_UPDATED_AT = "06/11/2026"

/** Versão registrada junto ao aceite do visitante (mesma data, em formato ISO). */
export const FORM_PRIVACY_CONSENT_VERSION = "2026-11-06"

/** Dados do controlador do formulário: o acesso master que contratou a plataforma. */
export type PublicFormLegalNotice = {
  companyName: string
  /** Documento do acesso master. Só um CNPJ válido é exibido; CPF é ignorado. */
  document: string | null
  contactEmail: string
}

const FALLBACK_COMPANY = "a empresa responsável por este formulário"
const DOCUMENT_CLAUSE = ", inscrita no {{documentLabel}} sob o nº {{document}}"

/** Só CNPJ é exibido aos visitantes; CPF nunca é divulgado, então vira ausência de documento. */
function formatDocument(raw: string): { label: "CNPJ"; value: string } | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length !== 14) return null
  return {
    label: "CNPJ",
    value: digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
  }
}

function fillTokens(text: string, notice: PublicFormLegalNotice | null): string {
  const company = notice?.companyName.trim() || FALLBACK_COMPANY
  const document = notice?.document ? formatDocument(notice.document) : null
  const withDocument = document
    ? text
        .replaceAll("{{documentLabel}}", document.label)
        .replaceAll("{{document}}", document.value)
    : text.replace(DOCUMENT_CLAUSE, "")

  return withDocument
    .replaceAll("{{company}}", company)
    .replaceAll("{{email}}", notice?.contactEmail.trim() || "o canal de suporte do Corretor Studio")
    .replaceAll("{{updatedAt}}", FORM_PRIVACY_POLICY_UPDATED_AT)
}

function fillSegments(segments: LegalSegment[], notice: PublicFormLegalNotice | null): LegalSegment[] {
  return segments.map((segment) => ({ ...segment, text: fillTokens(segment.text, notice) }))
}

/** Política de Privacidade do formulário com os dados do controlador já substituídos. */
export function renderFormPrivacyPolicy(notice: PublicFormLegalNotice | null): LegalBlock[] {
  return FORM_PRIVACY_POLICY_TEMPLATE.map((block): LegalBlock => {
    if (block.type === "h2" || block.type === "h3") {
      return { ...block, text: fillTokens(block.text, notice) }
    }
    if (block.type === "p") {
      return { ...block, segments: fillSegments(block.segments, notice) }
    }
    return { ...block, items: block.items.map((item) => fillSegments(item, notice)) }
  })
}
