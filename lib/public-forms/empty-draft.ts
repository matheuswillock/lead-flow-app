import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import { createDefaultThankYouPage } from "@/lib/public-forms/thank-you-pages"

const defaultThankYouPageSeed = createDefaultThankYouPage()

export function createEmptyPublicFormDraft(): PublicFormDraftInput {
  return {
    name: "",
    description: null,
    assignedSdrId: null,
    eligibleCloserIds: [],
    coverTitle: "",
    coverDescription: "",
    coverBadge: null,
    coverHighlights: [],
    ctaLabel: "Começar",
    successTitle: defaultThankYouPageSeed.title,
    successDescription: defaultThankYouPageSeed.description,
    successActions: [],
    thankYouPages: [defaultThankYouPageSeed],
    defaultThankYouPageId: defaultThankYouPageSeed.id,
    useDefaultTheme: true,
    backgroundColor: "#FFFFFF",
    textColor: "#18181B",
    lineColor: "#E4E4E7",
    accentColor: "#FF6900",
    buttonTextColor: "#FFFFFF",
    inputBackgroundColor: "#FFFFFF",
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    schedulingMessage: "",
    formKind: "standard",
    questions: [],
    rules: [],
    scoreBands: [],
  }
}
