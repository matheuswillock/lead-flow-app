"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocsChapter } from "../context/DocsTypes"
import { Button } from "@/components/ui/button";

interface DocsIndexProps {
  chapters: DocsChapter[]
  activeChapterId: string
  className?: string
  onSelect?: (chapterId: string) => void
}

const DOCS_SECTIONS = [
  { title: "Inicio", chapterIds: ["inicio", "visao-geral"] },
  {
    title: "Primeiros Passos",
    chapterIds: ["criar-conta", "login", "alterar-senha", "perfil", "google-calendar"],
  },
  {
    title: "Modulos",
    chapterIds: ["dashboard", "crm-kanban", "leads", "reunioes", "calendar", "carteira", "performance"],
  },
  {
    title: "Gestao & Config",
    chapterIds: ["equipe", "times", "integracoes", "assinatura"],
  },
  { title: "Ajuda", chapterIds: ["faq"] },
] as const

const SIDEBAR_LABELS: Record<string, string> = {
  inicio: "Índice",
  "visao-geral": "Visão Geral",
  "criar-conta": "Criar conta",
  login: "Fazer login",
  "alterar-senha": "Alterar senha",
  perfil: "Configurar perfil",
  "google-calendar": "Google Calendar",
  dashboard: "Dashboard",
  "crm-kanban": "CRM / Kanban",
  leads: "Gerenciar Leads",
  reunioes: "Agendar Reuniões",
  calendar: "Calendário",
  carteira: "Carteira",
  performance: "Performance",
  equipe: "Gerenciar Equipe",
  times: "Times",
  integracoes: "Integracoes",
  assinatura: "Assinatura",
  faq: "Perguntas Frequentes",
}

function getAvailabilityLabel(chapter: DocsChapter) {
  switch (chapter.availability) {
    case "beta":
      return {
        label: "Beta",
        className: "border-primary/20 bg-primary/10 text-primary",
      }
    case "comingSoon":
      return {
        label: "Em breve",
        className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
      }
    case "paid":
      return {
        label: "Assinantes",
        className: "border-primary/20 bg-primary/10 text-primary",
      }
    case "locked":
      return {
        label: "Bloqueado",
        className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
      }
    default:
      return null
  }
}

function getSidebarLabel(chapter: DocsChapter) {
  return SIDEBAR_LABELS[chapter.id] ?? chapter.title
}

export function DocsIndex({ chapters, activeChapterId, className, onSelect }: DocsIndexProps) {
  const sectionedChapters = DOCS_SECTIONS.map((section) => ({
    title: section.title,
    chapters: section.chapterIds
      .map((chapterId) => chapters.find((chapter) => chapter.id === chapterId))
      .filter((chapter): chapter is DocsChapter => Boolean(chapter)),
  })).filter((section) => section.chapters.length > 0)

  return (
    <nav
      aria-label="Navegação da documentação"
      className={cn(
        "h-full bg-[color-mix(in_oklab,var(--primary)_4%,var(--surface-1))]",
        className,
      )}
    >
      <div className="border-b border-primary/15 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-foreground">Corretor Studio</span>
        </div>
        <p className="mt-3 text-[9px] font-medium uppercase tracking-[0.24em] text-primary/80">
          Manual de Usuário — v1.0 2026
        </p>
      </div>

      <div className="px-0 py-3">
        {sectionedChapters.map((section, sectionIndex) => (
          <div
            key={section.title}
            className={cn(
              "pb-3 last:pb-0",
              sectionIndex > 0 ? "border-t border-primary/10 pt-3" : undefined,
            )}
          >
            <div className="px-5 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              {section.title}
            </div>

            <div>
              {section.chapters.map((chapter) => {
                const isActive = activeChapterId === chapter.id
                const availability = getAvailabilityLabel(chapter)
                const isDisabled = chapter.availability === "comingSoon"

                return (
                  <Button
                    key={chapter.id}
                    type="button"
                    variant="ghost"
                    aria-pressed={isActive}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        onSelect?.(chapter.id)
                      }
                    }}
                    className={cn(
                      "flex h-auto w-full items-center justify-between gap-3 rounded-none border-l-[3px] px-3 py-2 pr-4 text-left transition-colors",
                      isDisabled && "cursor-not-allowed opacity-55",
                      isActive
                        ? "border-l-primary bg-primary/8 text-foreground"
                        : isDisabled
                          ? "border-l-transparent text-muted-foreground/80"
                          : "border-l-transparent text-muted-foreground hover:bg-primary/6 hover:text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "min-w-[22px] font-mono text-[11px] font-semibold tabular-nums",
                          isActive ? "text-primary" : "text-muted-foreground/80",
                        )}
                      >
                        {chapter.indexLabel}
                      </span>
                      <span
                        className={cn(
                          "truncate text-[12px] font-normal tracking-tight",
                          isActive ? "text-foreground" : "text-inherit",
                        )}
                      >
                        {getSidebarLabel(chapter)}
                      </span>
                    </span>

                    {availability ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0 text-[9px] font-medium uppercase tracking-[0.08em]",
                          availability.className,
                        )}
                      >
                        {availability.label}
                      </Badge>
                    ) : null}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
