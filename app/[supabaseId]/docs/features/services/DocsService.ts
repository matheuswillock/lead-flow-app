import type { DocsChapter } from "../context/DocsTypes"
import type { IDocsService } from "./IDocsService"
import { DOCS_MANUAL_CHAPTERS } from "./docsManualData"

export class DocsService implements IDocsService {
  listChapters(): DocsChapter[] {
    return DOCS_MANUAL_CHAPTERS
  }

  getChapterBySlug(slug: string): DocsChapter | null {
    return DOCS_MANUAL_CHAPTERS.find((chapter) => chapter.id === slug) ?? null
  }
}
