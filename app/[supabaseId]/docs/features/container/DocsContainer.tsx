"use client"

import { useEffect, useRef, useState } from "react"
import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useDocsContext } from "../context/DocsContext"
import { DocsChapterSection } from "../components/DocsChapterSection"
import { DocsIndex } from "../components/DocsIndex"

const DEFAULT_CHAPTER_ID = "inicio"

export function DocsContainer() {
  const { chapters } = useDocsContext()
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [activeChapterId, setActiveChapterId] = useState(DEFAULT_CHAPTER_ID)
  const navigableChapters = chapters.filter((chapter) => chapter.availability !== "comingSoon")

  const fallbackChapterId =
    navigableChapters.find((chapter) => chapter.id === DEFAULT_CHAPTER_ID)?.id ??
    navigableChapters[0]?.id ??
    ""
  const activeChapter =
    navigableChapters.find((chapter) => chapter.id === activeChapterId) ??
    navigableChapters[0] ??
    null
  const activeChapterIndex = activeChapter
    ? navigableChapters.findIndex((chapter) => chapter.id === activeChapter.id)
    : -1
  const previousChapter = activeChapterIndex > 0 ? navigableChapters[activeChapterIndex - 1] : null
  const nextChapter =
    activeChapterIndex >= 0 && activeChapterIndex < navigableChapters.length - 1
      ? navigableChapters[activeChapterIndex + 1]
      : null

  useEffect(() => {
    const availableChapters = chapters.filter((chapter) => chapter.availability !== "comingSoon")

    if (!availableChapters.length || typeof window === "undefined") {
      return
    }

    const defaultChapterId =
      availableChapters.find((chapter) => chapter.id === DEFAULT_CHAPTER_ID)?.id ??
      availableChapters[0].id

    const syncFromLocation = () => {
      const chapterId = new URLSearchParams(window.location.search).get("chapter")
      const hash = window.location.hash.replace("#", "")
      const matchedChapter = availableChapters.find((chapter) => chapter.id === chapterId || chapter.id === hash)

      setActiveChapterId(matchedChapter?.id ?? defaultChapterId)

      if (!matchedChapter && hash) {
        const url = new URL(window.location.href)
        url.hash = defaultChapterId
        window.history.replaceState(null, "", url.toString())
      }

      requestAnimationFrame(() => {
        viewerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
      })
    }

    syncFromLocation()
    window.addEventListener("hashchange", syncFromLocation)
    window.addEventListener("popstate", syncFromLocation)

    return () => {
      window.removeEventListener("hashchange", syncFromLocation)
      window.removeEventListener("popstate", syncFromLocation)
    }
  }, [chapters])

  function handleSelectChapter(chapterId: string) {
    if (!chapterId || typeof window === "undefined") {
      return
    }

    const chapter = navigableChapters.find((entry) => entry.id === chapterId)

    if (!chapter) {
      return
    }

    setActiveChapterId(chapterId)
    setIsMobileNavOpen(false)

    const url = new URL(window.location.href)
    url.searchParams.set("chapter", chapterId)
    url.hash = chapterId
    window.history.replaceState(null, "", url.toString())

    requestAnimationFrame(() => {
      viewerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    })
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="border-b border-border/70 px-4 py-3 xl:hidden">
        <Drawer open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Capítulo atual
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {activeChapter?.title ?? "Documentação"}
              </p>
            </div>
            <DrawerTrigger asChild>
              <Button type="button" variant="outline" className="rounded-xl">
                <PanelLeft className="h-4 w-4" />
                Capítulos
              </Button>
            </DrawerTrigger>
          </div>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Capítulos da documentação</DrawerTitle>
              <DrawerDescription>
                Escolha a página que você quer abrir no painel principal.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <div className="activity-scrollbar max-h-[60vh] overflow-y-auto pr-1">
                <DocsIndex
                  chapters={chapters}
                  activeChapterId={activeChapter?.id ?? fallbackChapterId}
                  onSelect={handleSelectChapter}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[272px_minmax(0,1fr)] 2xl:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 xl:block xl:border-r xl:border-primary/10 xl:bg-[color-mix(in_oklab,var(--primary)_4%,var(--surface-1))]">
          <div className="activity-scrollbar h-full overflow-y-auto">
            <DocsIndex
              chapters={chapters}
              activeChapterId={activeChapter?.id ?? fallbackChapterId}
              onSelect={handleSelectChapter}
            />
          </div>
        </aside>

        {activeChapter ? (
          <div ref={viewerRef} className="activity-scrollbar flex min-h-0 h-full flex-col overflow-y-auto">
            <DocsChapterSection
              chapter={activeChapter}
              currentIndexLabel={activeChapter.indexLabel}
              totalChapters={chapters.length}
              previousChapter={previousChapter}
              nextChapter={nextChapter}
              onSelectChapter={handleSelectChapter}
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}
