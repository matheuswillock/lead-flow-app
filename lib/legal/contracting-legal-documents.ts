import { contractingDocuments } from "./contracting-documents-data"
import type { LegalBlock, LegalDocument } from "./legal-document-types"

const COOKIES_SECTION_NUMBER = 8
const NUMBERED_TEXT = /^(\d+)(\.\d+)?(\.)(\s)/

function isSectionHeading(block: LegalBlock): boolean {
  return block.type === "h2"
}

function sectionNumberOf(text: string): number | null {
  const match = NUMBERED_TEXT.exec(text)
  return match ? Number(match[1]) : null
}

/** Troca o número da seção no início do texto ("9.2. Embora" vira "8.2. Embora"). */
function withSectionNumber(text: string, nextSection: number): string {
  return text.replace(NUMBERED_TEXT, (_all, _section, sub: string | undefined, dot: string, space: string) => {
    return `${nextSection}${sub ?? ""}${dot}${space}`
  })
}

function renumberBlock(block: LegalBlock, mapSection: (section: number) => number): LegalBlock {
  if (block.type === "h2" || block.type === "h3") {
    const section = sectionNumberOf(block.text)
    return section === null ? block : { ...block, text: withSectionNumber(block.text, mapSection(section)) }
  }
  if (block.type === "p") {
    const [first, ...rest] = block.segments
    const section = first ? sectionNumberOf(first.text) : null
    if (!first || section === null) return block
    return {
      ...block,
      segments: [{ ...first, text: withSectionNumber(first.text, mapSection(section)) }, ...rest],
    }
  }
  return block
}

function findCookiesRange(blocks: readonly LegalBlock[]): { start: number; end: number } | null {
  const start = blocks.findIndex(
    (block) => isSectionHeading(block) && "text" in block && sectionNumberOf(block.text) === COOKIES_SECTION_NUMBER,
  )
  if (start === -1) return null
  const nextHeading = blocks.findIndex((block, index) => index > start && isSectionHeading(block))
  return { start, end: nextHeading === -1 ? blocks.length : nextHeading }
}

/**
 * Política de Privacidade da contratação sem a seção de cookies (que vira documento próprio):
 * as seções seguintes sobem um número para a sequência continuar sem lacuna.
 */
export function buildPrivacyWithoutCookies(document: LegalDocument): LegalDocument {
  const range = findCookiesRange(document.blocks)
  if (!range) return document
  const kept = [...document.blocks.slice(0, range.start), ...document.blocks.slice(range.end)]
  const renumbered = kept.map((block, index) =>
    index < range.start ? block : renumberBlock(block, (section) => (section > COOKIES_SECTION_NUMBER ? section - 1 : section)),
  )
  return { ...document, blocks: renumbered }
}

/** Política de Cookies da contratação: a seção de cookies da política, renumerada a partir de 1. */
export function buildCookiesDocument(privacy: LegalDocument): LegalDocument {
  const range = findCookiesRange(privacy.blocks)
  const blocks = range
    ? privacy.blocks.slice(range.start, range.end).map((block) => renumberBlock(block, () => 1))
    : []
  return { title: "Política de Cookies", updatedAt: privacy.updatedAt, blocks }
}

/** Documentos que o cliente aceita na contratação, cada um com numeração própria e contínua. */
export const contractingLegalDocuments = {
  terms: contractingDocuments.terms,
  privacy: buildPrivacyWithoutCookies(contractingDocuments.privacy),
  cookies: buildCookiesDocument(contractingDocuments.privacy),
} satisfies Record<"terms" | "privacy" | "cookies", LegalDocument>
