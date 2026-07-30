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

function isFormManagedNoteLine(line: string, snapshot: PublicFormSnapshot): boolean {
  return formNoteLinePrefixes(snapshot).some((prefix) => line.startsWith(prefix))
}

/** Replace form-managed note lines while preserving unrelated CRM notes. */
export function mergeFormMappedLeadNotes(
  existingNotes: string | null | undefined,
  snapshot: PublicFormSnapshot,
  incomingLines: string[],
): string | undefined {
  const incoming = incomingLines.map((line) => line.trim()).filter(Boolean)
  const preserved = (existingNotes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isFormManagedNoteLine(line, snapshot))

  if (incoming.length === 0) {
    return preserved.length > 0 ? preserved.join("\n") : undefined
  }

  return [...preserved, ...incoming].join("\n")
}
