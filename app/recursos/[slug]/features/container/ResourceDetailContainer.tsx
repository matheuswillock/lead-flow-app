"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import { getPublicResourcePath } from "@/lib/seo/publicResources"
import { useResourceDetailContext } from "../context/ResourceDetailContext"

export function ResourceDetailContainer() {
  const { resource, relatedResources, getBreadcrumbs } = useResourceDetailContext()
  const breadcrumbs = getBreadcrumbs()

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: getAbsoluteUrl(item.href),
    })),
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: resource.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-10 py-14 md:py-20">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <span key={item.href} className="inline-flex items-center gap-2">
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
              {index < breadcrumbs.length - 1 ? <span>/</span> : null}
            </span>
          ))}
        </nav>

        <p className="mt-6 text-sm uppercase tracking-wide text-muted-foreground">{resource.intent}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight">{resource.heroTitle}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{resource.heroSubtitle}</p>

        <section className="mt-10 rounded-2xl border border-border p-6 md:p-8 landing-surface-card-soft">
          <h2 className="text-2xl font-bold tracking-tight">{resource.proofTitle}</h2>
          <ul className="mt-5 space-y-3 text-foreground/90 leading-relaxed">
            {resource.proofPoints.map((point) => (
              <li key={point}>- {point}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Cenarios de aplicacao</h2>
          <ul className="mt-5 space-y-3 text-muted-foreground leading-relaxed">
            {resource.useCases.map((useCase) => (
              <li key={useCase}>- {useCase}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">FAQ rapido</h2>
          <div className="mt-5 space-y-5">
            {resource.faq.map((faqItem) => (
              <article key={faqItem.question}>
                <h3 className="text-lg font-semibold">{faqItem.question}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{faqItem.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Proximos passos</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Se quiser transformar o processo comercial em uma operacao mais previsivel, veja os planos e marque uma demonstracao.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/subscribe" className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-primary-cta">
              Ver assinatura
            </Link>
            <Link href="/recursos" className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-secondary-cta">
              Voltar para recursos
            </Link>
            <Link
              href="/privacy-policy"
              className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-secondary-cta"
            >
              Politica de Privacidade
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">Conteudos relacionados</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {relatedResources.map((item) => (
              <Link
                key={item.slug}
                href={getPublicResourcePath(item.slug)}
                className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/30"
              >
                <h3 className="text-base font-semibold">{item.intent}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                <span className="mt-3 inline-flex items-center text-sm text-primary font-semibold">
                  Acessar guia
                  <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8">
          <Link href="/recursos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar para central de recursos
          </Link>
        </div>
      </section>
    </main>
  )
}
