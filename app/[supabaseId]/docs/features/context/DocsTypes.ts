export type DocsAvailability = "available" | "beta" | "comingSoon" | "paid" | "locked"

export type DocsAudience = "all" | "manager" | "operator" | "master"

export type DocsCalloutTone = "info" | "warning" | "success"

export interface DocsStepItem {
  marker?: string
  title: string
  description: string
}

export interface DocsFeatureItem {
  title: string
  description: string
}

export interface DocsTableRow {
  cells: string[]
  badgeTone?: "required" | "optional" | "neutral"
}

export interface DocsFaqItem {
  question: string
  answer: string
}

export type DocsBlock =
  | {
      type: "paragraph"
      title?: string
      content: string
    }
  | {
      type: "panel"
      title: string
      lines: string[]
    }
  | {
      type: "callout"
      title: string
      content: string
      tone: DocsCalloutTone
    }
  | {
      type: "steps"
      title?: string
      items: DocsStepItem[]
    }
  | {
      type: "features"
      title?: string
      columns?: 2 | 3
      items: DocsFeatureItem[]
    }
  | {
      type: "table"
      title?: string
      columns: string[]
      rows: DocsTableRow[]
    }
  | {
      type: "statusFlow"
      title: string
      items: string[]
      terminalItems?: string[]
    }
  | {
      type: "tableOfContents"
    }
  | {
      type: "faq"
      items: DocsFaqItem[]
    }

export interface DocsNotice {
  title: string
  content: string
  tone: DocsCalloutTone
}

export interface DocsChapter {
  id: string
  indexLabel: string
  title: string
  eyebrow: string
  lead: string
  availability: DocsAvailability
  audience: DocsAudience
  audienceNote?: string
  availabilityNotice?: DocsNotice
  blocks: DocsBlock[]
}

export interface DocsState {
  chapters: DocsChapter[]
}

export interface DocsActions {
  getChapterBySlug: (slug: string) => DocsChapter | null
}

export type DocsContextValue = DocsState & DocsActions
