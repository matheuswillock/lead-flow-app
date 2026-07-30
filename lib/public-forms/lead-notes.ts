import type { PublicFormSnapshot } from "./types"

export const PUBLIC_FORM_SCORE_NOTE_PREFIX = "Qualificação:"

function formNoteLinePrefixes(snapshot: PublicFormSnapshot): string[] {
  return [
    ...snapshot.questions
      .filter((question) => question.mappingTarget === "notes")
      .map((question) => `${question.title}: `),
    PUBLIC_FORM_SCORE_NOTE_PREFIX,
  ]
}

function longestMatchingPrefix(line: string, prefixes: string[]): string | undefined {
  return prefixes
    .filter((prefix) => line.startsWith(prefix))
    .sort((left, right) => right.length - left.length)[0]
}

function prefixesInIncoming(incoming: string[], prefixes: string[]): Set<string> {
  const matched = new Set<string>()
  for (const line of incoming) {
    const prefix = longestMatchingPrefix(line, prefixes)
    if (prefix) matched.add(prefix)
  }
  return matched
}

type ParsedBlock =
  | { kind: "manual"; text: string }
  | { kind: "managed"; prefix: string; text: string }

function parseExistingNoteBlocks(existingNotes: string, prefixes: string[]): ParsedBlock[] {
  const rawLines = existingNotes.split("\n")

  const blocks: ParsedBlock[] = []
  let activeManaged: { prefix: string; lines: string[] } | null = null

  const flushManaged = () => {
    if (!activeManaged) return
    blocks.push({
      kind: "managed",
      prefix: activeManaged.prefix,
      text: activeManaged.lines.join("\n"),
    })
    activeManaged = null
  }

  for (const rawLine of rawLines) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const prefix = longestMatchingPrefix(line, prefixes)
    if (prefix) {
      flushManaged()
      activeManaged = { prefix, lines: [line] }
      continue
    }

    if (activeManaged) {
      if (/^\s{2,}/.test(rawLine)) {
        activeManaged.lines.push(`  ${line}`)
        continue
      }

      flushManaged()
      blocks.push({ kind: "manual", text: line })
      continue
    }

    blocks.push({ kind: "manual", text: line })
  }

  flushManaged()
  return blocks
}

/** Replace form-managed note lines while preserving unrelated CRM notes. */
export function mergeFormMappedLeadNotes(
  existingNotes: string | null | undefined,
  snapshot: PublicFormSnapshot,
  incomingLines: string[],
): string | undefined {
  const prefixes = formNoteLinePrefixes(snapshot)
  const incoming = incomingLines.map((line) => line.trim()).filter(Boolean)

  if (incoming.length === 0) {
    const trimmed = (existingNotes ?? "").trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const prefixesToReplace = prefixesInIncoming(incoming, prefixes)
  const preservedBlocks = parseExistingNoteBlocks(existingNotes ?? "", prefixes).filter((block) => {
    if (block.kind === "manual") return true
    return !prefixesToReplace.has(block.prefix)
  })

  const merged = [...preservedBlocks.map((block) => block.text), ...incoming]
  return merged.length > 0 ? merged.join("\n") : undefined
}
