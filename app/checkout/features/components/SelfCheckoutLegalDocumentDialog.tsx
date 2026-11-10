"use client"

import { Fragment, type ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { contractingLegalDocuments } from "@/lib/legal/contracting-legal-documents"
import type { LegalSegment } from "@/lib/legal/legal-document-types"

function Segments({ segments }: { segments: LegalSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="font-semibold text-foreground">
            {segment.text}
          </strong>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * Abre, dentro da contratação, o documento que o cliente declara ter lido: Termos de Uso, Política
 * de Privacidade ou Política de Cookies (separada da privacidade), nas versões da contratação.
 */
export function SelfCheckoutLegalDocumentDialog({
  documentKey,
  children,
}: {
  documentKey: keyof typeof contractingLegalDocuments
  children: ReactNode
}) {
  const document = contractingLegalDocuments[documentKey]

  return (
    <Dialog>
      {/*
        Link dentro da frase do aceite: fica em linha com o texto (exceção de alvo de toque para
        links em texto corrido, WCAG 2.5.8). Teclado: Enter e espaço abrem o documento.
      */}
      <DialogTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              event.currentTarget.click()
            }
          }}
          className="cursor-pointer font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </span>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle className="font-display text-xl font-bold">{document.title}</DialogTitle>
          <DialogDescription>
            {document.updatedAt ? `Última atualização: ${document.updatedAt}` : "Documento da contratação"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground">
          {document.blocks.map((block, index) => {
            if (block.type === "h2") {
              return (
                <h3 key={index} className="mt-4 text-base font-semibold text-foreground">
                  {block.text}
                </h3>
              )
            }
            if (block.type === "h3") {
              return (
                <h4 key={index} className="mt-2 font-semibold text-foreground">
                  {block.text}
                </h4>
              )
            }
            if (block.type === "ul") {
              return (
                <ul key={index} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Segments segments={item} />
                    </li>
                  ))}
                </ul>
              )
            }
            return (
              <p key={index}>
                <Segments segments={block.segments} />
              </p>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
