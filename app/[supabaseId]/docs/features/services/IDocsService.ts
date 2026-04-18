import type { DocsChapter } from "../context/DocsTypes"

export interface IDocsService {
  listChapters(): DocsChapter[]
  getChapterBySlug(slug: string): DocsChapter | null
}
