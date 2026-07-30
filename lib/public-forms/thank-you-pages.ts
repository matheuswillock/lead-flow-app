import type {
  PublicFormDraftInput,
  PublicFormSuccessAction,
  PublicFormThankYouPage,
} from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"

export function createDefaultThankYouPage(
  overrides?: Partial<PublicFormThankYouPage>,
): PublicFormThankYouPage {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    name: overrides?.name ?? "Página padrão",
    title: overrides?.title ?? "Respostas enviadas",
    description: overrides?.description ?? "Obrigado por responder.",
    actions: overrides?.actions ?? [],
    kind: overrides?.kind ?? "standard",
    isDefault: overrides?.isDefault ?? true,
  }
}

export function parseThankYouPages(value: unknown): PublicFormThankYouPage[] {
  if (!Array.isArray(value)) return []
  const pages: PublicFormThankYouPage[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== "string" || typeof record.name !== "string") continue
    if (typeof record.title !== "string") continue
    const kind = record.kind === "simulation" ? "simulation" : "standard"
    const actions = Array.isArray(record.actions)
      ? (record.actions as PublicFormSuccessAction[])
      : []
    pages.push({
      id: record.id,
      name: record.name,
      title: record.title,
      description: typeof record.description === "string" ? record.description : null,
      actions,
      kind,
      isDefault: record.isDefault === true,
    })
  }
  return pages
}

/** Normalize legacy flat success fields into thank-you pages array. */
export function normalizeThankYouPages(draft: PublicFormDraftInput): PublicFormDraftInput {
  let pages = draft.thankYouPages?.length
    ? draft.thankYouPages
    : parseThankYouPages((draft as { thankYouPages?: unknown }).thankYouPages)

  if (pages.length === 0) {
    pages = [
      createDefaultThankYouPage({
        title: draft.successTitle || "Respostas enviadas",
        description: draft.successDescription ?? "Obrigado por responder.",
        actions: draft.successActions ?? [],
        kind: draft.formKind === "health_plan_simulator" ? "simulation" : "standard",
        isDefault: true,
      }),
    ]
  }

  const defaultPage =
    pages.find((page) => page.id === draft.defaultThankYouPageId) ??
    pages.find((page) => page.isDefault) ??
    pages[0]!

  const normalizedPages = pages.map((page) => ({
    ...page,
    isDefault: page.id === defaultPage.id,
  }))

  const defaultPageResolved = normalizedPages.find((page) => page.isDefault) ?? normalizedPages[0]!

  return {
    ...draft,
    thankYouPages: normalizedPages,
    defaultThankYouPageId: defaultPageResolved.id,
    successTitle: defaultPageResolved.title,
    successDescription: defaultPageResolved.description,
    successActions: defaultPageResolved.actions,
  }
}

export function isThankYouRuleTarget(targetQuestionId: string): boolean {
  return targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET
}

export function resolveThankYouPage(
  draft: PublicFormDraftInput,
  pageId?: string | null,
): PublicFormThankYouPage {
  const normalized = normalizeThankYouPages(draft)
  if (pageId) {
    const match = normalized.thankYouPages.find((page) => page.id === pageId)
    if (match) return match
  }
  return (
    normalized.thankYouPages.find((page) => page.id === normalized.defaultThankYouPageId) ??
    normalized.thankYouPages[0]!
  )
}

export function thankYouPageLabel(
  draft: PublicFormDraftInput,
  pageId?: string | null,
): string {
  if (!pageId) return "página de agradecimentos (padrão)"
  const page = normalizeThankYouPages(draft).thankYouPages.find((item) => item.id === pageId)
  return page?.name ?? "página de agradecimentos"
}
