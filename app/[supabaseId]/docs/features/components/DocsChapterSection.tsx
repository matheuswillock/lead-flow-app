"use client"

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Mail,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type {
  DocsBlock,
  DocsCalloutTone,
  DocsChapter,
  DocsTableRow,
} from "../context/DocsTypes"

interface DocsChapterSectionProps {
  chapter: DocsChapter
  currentIndexLabel: string
  totalChapters: number
  previousChapter: DocsChapter | null
  nextChapter: DocsChapter | null
  onSelectChapter: (chapterId: string) => void
}

function getAvailabilityBadge(chapter: DocsChapter) {
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

function getAudienceBadge(chapter: DocsChapter) {
  switch (chapter.audience) {
    case "manager":
      return { label: "Manager", className: "border-border bg-surface-2 text-foreground" }
    case "operator":
      return { label: "Operador", className: "border-border bg-surface-2 text-foreground" }
    case "master":
      return { label: "Master", className: "border-border bg-surface-2 text-foreground" }
    default:
      return { label: "Todos", className: "border-border bg-surface-2 text-foreground" }
  }
}

function getCalloutConfig(tone: DocsCalloutTone): { Icon: LucideIcon; className: string } {
  switch (tone) {
    case "success":
      return {
        Icon: ShieldCheck,
        className:
          "border-semantic-success-border bg-semantic-success-surface/70 [&>svg]:text-semantic-success",
      }
    case "warning":
      return {
        Icon: TriangleAlert,
        className:
          "border-semantic-warning-border bg-semantic-warning-surface/70 [&>svg]:text-semantic-warning",
      }
    default:
      return {
        Icon: Info,
        className:
          "border-semantic-info-border bg-semantic-info-surface/70 [&>svg]:text-semantic-info",
      }
  }
}

function getTableBadge(row: DocsTableRow) {
  switch (row.badgeTone) {
    case "required":
      return "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
    case "optional":
      return "border-semantic-info-border bg-semantic-info-surface text-semantic-info"
    default:
      return "border-border bg-surface-2 text-foreground"
  }
}

function renderBlock(block: DocsBlock, chapter: DocsChapter) {
  switch (block.type) {
    case "paragraph":
      return (
        <div className="space-y-3">
          {block.title ? <h3 className="text-base font-semibold tracking-tight">{block.title}</h3> : null}
          <p className="text-sm leading-7 text-muted-foreground sm:text-[15px]">{block.content}</p>
        </div>
      )

    case "panel":
      return (
        <div className="rounded-2xl border border-border/70 bg-surface-2 p-5 shadow-[var(--precision-shadow-1)]">
          <h3 className="text-base font-semibold tracking-tight">{block.title}</h3>
          <ul className="mt-4 space-y-3">
            {block.lines.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                <span className="mt-2 h-2 w-2 rounded-full bg-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case "callout": {
      const config = getCalloutConfig(block.tone)

      return (
        <Alert className={config.className}>
          <config.Icon className="h-4 w-4" />
          <AlertTitle>{block.title}</AlertTitle>
          <AlertDescription>{block.content}</AlertDescription>
        </Alert>
      )
    }

    case "steps":
      return (
        <div className="space-y-4">
          {block.title ? <h3 className="text-base font-semibold tracking-tight">{block.title}</h3> : null}
          <ol className="space-y-3">
            {block.items.map((item, index) => {
              const marker = item.marker ?? String(index + 1).padStart(2, "0")

              return (
                <li
                  key={`${chapter.id}-${item.title}-${marker}`}
                  className="flex gap-4 rounded-2xl border border-border/70 bg-surface-0 px-4 py-4 shadow-[var(--precision-shadow-1)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {marker}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )

    case "features":
      return (
        <div className="space-y-4">
          {block.title ? <h3 className="text-base font-semibold tracking-tight">{block.title}</h3> : null}
          <div
            className={cn(
              "grid gap-3",
              block.columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2",
            )}
          >
            {block.items.map((item) => (
              <div
                key={`${chapter.id}-${item.title}`}
                className="rounded-2xl border border-border/70 bg-surface-0 p-4 shadow-[var(--precision-shadow-1)]"
              >
                <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )

    case "table":
      return (
        <div className="space-y-4">
          {block.title ? <h3 className="text-base font-semibold tracking-tight">{block.title}</h3> : null}
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface-0 shadow-[var(--precision-shadow-1)]">
            <Table>
              <TableHeader className="bg-surface-2/70">
                <TableRow className="hover:bg-transparent">
                  {block.columns.map((column) => (
                    <TableHead
                      key={column}
                      className="whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.18em]"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {block.rows.map((row, rowIndex) => (
                  <TableRow key={`${chapter.id}-${block.title ?? "table"}-${rowIndex}`} className="bg-transparent">
                    {row.cells.map((cell, cellIndex) => {
                      const isBadgeCell = Boolean(row.badgeTone) && cellIndex === row.cells.length - 1

                      return (
                        <TableCell key={`${chapter.id}-${cell}-${cellIndex}`} className="px-4 py-3 align-top text-sm leading-6">
                          {isBadgeCell ? (
                            <Badge variant="outline" className={getTableBadge(row)}>
                              {cell}
                            </Badge>
                          ) : (
                            cell
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )

    case "statusFlow":
      return (
        <div className="space-y-4">
          <h3 className="text-base font-semibold tracking-tight">{block.title}</h3>
          <div className="rounded-2xl border border-border/70 bg-surface-0 p-4 shadow-[var(--precision-shadow-1)]">
            <div className="flex flex-wrap items-center gap-2">
              {block.items.map((item) => (
                <Badge key={`${chapter.id}-${item}`} variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  {item}
                </Badge>
              ))}
            </div>

            {block.terminalItems?.length ? (
              <>
                <Separator className="my-4" />
                <div className="flex flex-wrap items-center gap-2">
                  {block.terminalItems.map((item) => (
                    <Badge
                      key={`${chapter.id}-${item}`}
                      variant="outline"
                      className={cn(
                        item === "Vendido"
                          ? "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
                          : "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
                      )}
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )

    case "faq":
      return (
        <Accordion
          type="single"
          collapsible
          className="rounded-2xl border border-border/70 bg-surface-0 px-4 shadow-[var(--precision-shadow-1)]"
        >
          {block.items.map((item, index) => (
            <AccordionItem key={item.question} value={`${chapter.id}-faq-${index}`}>
              <AccordionTrigger className="text-left text-sm font-semibold tracking-tight text-foreground hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )

    case "tableOfContents":
      return null

    default:
      return null
  }
}

export function DocsChapterSection({
  chapter,
  currentIndexLabel,
  totalChapters,
  previousChapter,
  nextChapter,
  onSelectChapter,
}: DocsChapterSectionProps) {
  const availability = getAvailabilityBadge(chapter)
  const audience = getAudienceBadge(chapter)
  const isHomeChapter = chapter.id === "inicio"

  return (
    <section id={chapter.id} className="flex min-h-full flex-1 flex-col scroll-mt-24">
      <div className="flex min-h-full flex-1 flex-col">
        <div className="space-y-6 border-b border-border/70 px-6 py-6 lg:px-8">
          {isHomeChapter ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-primary/20 bg-primary/10 text-primary shadow-none hover:bg-primary/10">
                  Docs
                </Badge>
                <Badge variant="outline" className="border-border bg-surface-2 text-foreground">
                  {totalChapters} capitulos
                </Badge>
                <Badge variant="outline" className="border-border bg-surface-2 text-foreground">
                  Manual interno
                </Badge>
                <Badge variant="outline" className="border-border bg-surface-2 text-foreground">
                  v1.0 — 2026
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-primary">Corretor Studio</p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  documentação operacional centralizada
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Consulte o manual completo da plataforma em uma unica rota, escolha um capitulo no
                  sidebar e avance pela documentação sem carregar todos os passos de uma vez.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => onSelectChapter("visao-geral")} className="rounded-xl">
                  Comecar pela visao geral
                </Button>
                <Button
                  onClick={() => onSelectChapter("crm-kanban")}
                  variant="outline"
                  className="rounded-xl border-border bg-surface-0"
                >
                  Revisar CRM e Kanban
                </Button>
                <Button
                  onClick={() => onSelectChapter("faq")}
                  variant="outline"
                  className="rounded-xl border-border bg-surface-0"
                >
                  Abrir FAQ
                </Button>
              </div>

              <Alert className="w-full border-semantic-warning-border bg-semantic-warning-surface/70 shadow-[var(--precision-shadow-1)] [&>svg]:text-semantic-warning">
                <Sparkles className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  <span>Novidades em desenvolvimento</span>
                  <Badge
                    variant="outline"
                    className="border-semantic-warning-border bg-surface-0 text-semantic-warning"
                  >
                    Em breve
                  </Badge>
                </AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Estamos preparando o <strong>gerenciamento de e-mails</strong> do Corretor Studio para
                    ampliar a operacao comercial da plataforma.
                  </p>
                  <div className="flex items-start gap-2 rounded-xl border border-semantic-warning-border/60 bg-surface-0 px-3 py-3 text-sm text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-semantic-warning" />
                    <span>Templates, contatos, campanhas e histórico vão chegar em uma entrega futura.</span>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  {chapter.eyebrow}
                </Badge>
                <Badge variant="outline" className={audience.className}>
                  {audience.label}
                </Badge>
                {availability ? (
                  <Badge variant="outline" className={availability.className}>
                    {availability.label}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Capitulo {chapter.indexLabel}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                  {chapter.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{chapter.lead}</p>
              </div>

              {chapter.audienceNote ? (
                <Alert className="border-border bg-surface-2 [&>svg]:text-primary">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Escopo de acesso</AlertTitle>
                  <AlertDescription>{chapter.audienceNote}</AlertDescription>
                </Alert>
              ) : null}

              {chapter.availabilityNotice
                ? (() => {
                    const config = getCalloutConfig(chapter.availabilityNotice.tone)

                    return (
                      <Alert className={config.className}>
                        <config.Icon className="h-4 w-4" />
                        <AlertTitle>{chapter.availabilityNotice.title}</AlertTitle>
                        <AlertDescription>{chapter.availabilityNotice.content}</AlertDescription>
                      </Alert>
                    )
                  })()
                : null}
            </>
          )}
        </div>

        <div className="flex-1 space-y-6 border-b border-border/70 px-6 py-6 lg:px-8">
          {chapter.blocks.map((block, index) => (
            <div key={`${chapter.id}-${block.type}-${index}`} className="space-y-6">
              {renderBlock(block, chapter)}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => previousChapter && onSelectChapter(previousChapter.id)}
            disabled={!previousChapter}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {currentIndexLabel} / {String(totalChapters).padStart(2, "0")}
          </div>

          <Button
            type="button"
            onClick={() => nextChapter && onSelectChapter(nextChapter.id)}
            disabled={!nextChapter}
            className="w-full sm:w-auto"
          >
            Proximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
