import Link from "next/link"
import { Fragment } from "react"
import { DemoRequestDialogProvider } from "@/components/landing/DemoRequestDialog"
import { LandingHeader } from "@/components/landing/landingHeader"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { legalDocuments } from "@/lib/legal/legal-documents-data"
import type { LegalSegment } from "@/lib/legal/legal-document-types"

type LegalDocumentKey = keyof typeof legalDocuments

const legalLinks: Array<{ key: LegalDocumentKey; href: string; label: string }> = [
  { key: "terms", href: "/terms", label: "Termos de Uso" },
  { key: "privacy", href: "/privacy-policy", label: "Política de Privacidade" },
  { key: "cookies", href: "/cookies", label: "Política de Cookies" },
]

function Segments({ segments }: { segments: LegalSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="font-semibold text-landing-ink">
            {segment.text}
          </strong>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}

type LegalDocumentPageProps = {
  documentKey: LegalDocumentKey
}

export function LegalDocumentPage({ documentKey }: LegalDocumentPageProps) {
  const document = legalDocuments[documentKey]

  return (
    <DemoRequestDialogProvider>
      <main className="landing-page min-h-screen bg-card text-landing-ink">
        <LandingHeader />

        <article className="mx-auto max-w-3xl px-6 pb-20 pt-32 sm:px-8 md:pb-28">
          <header className="border-b border-landing-line pb-8">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.05em] text-primary">
              Documento institucional
            </p>
            <h1 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-5xl">
              {document.title}
            </h1>
            {document.updatedAt ? (
              <p className="mt-4 text-sm text-landing-muted">Última atualização: {document.updatedAt}</p>
            ) : null}
          </header>

          <div className="mt-8 flex flex-col gap-4 text-base leading-8 text-landing-body">
            {document.blocks.map((block, index) => {
              if (block.type === "h2") {
                return (
                  <h2
                    key={index}
                    className="mt-8 font-display text-xl font-bold tracking-[-0.02em] text-landing-ink md:text-2xl"
                  >
                    {block.text}
                  </h2>
                )
              }

              if (block.type === "h3") {
                return (
                  <h3 key={index} className="mt-4 font-display text-lg font-bold text-landing-ink">
                    {block.text}
                  </h3>
                )
              }

              if (block.type === "ul") {
                return (
                  <ul key={index} className="flex list-disc flex-col gap-2 pl-6 marker:text-primary">
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

          <nav
            aria-label="Outros documentos legais"
            className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-landing-line pt-6 text-sm"
          >
            {legalLinks
              .filter((link) => link.key !== documentKey)
              .map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
                >
                  {link.label}
                </Link>
              ))}
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-landing-body underline underline-offset-4"
            >
              Voltar para a home
            </Link>
          </nav>
        </article>

        <LandingFooter />
      </main>
    </DemoRequestDialogProvider>
  )
}
