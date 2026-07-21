"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useResourcesContext } from "../context/ResourcesContext"
import { getPublicResourcePath } from "@/lib/seo/publicResources"
import { getAbsoluteUrl } from "@/lib/metadata/share"

export function ResourcesContainer() {
  const { resources } = useResourcesContext()

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Recursos Corretor Studio",
    url: getAbsoluteUrl("/recursos"),
    description:
      "Central de conteúdo sobre CRM, pipeline, gestão de equipe e integrações para corretores de planos de saúde.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: resources.map((resource, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: resource.intent,
        url: getAbsoluteUrl(getPublicResourcePath(resource.slug)),
      })),
    },
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <section className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16 md:py-20">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Recursos</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight">
            Conteúdo estratégico para corretores de saúde
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Guias objetivos para elevar conversão comercial com CRM, pipeline, operação em equipe e integrações.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {resources.map((resource) => (
            <article key={resource.slug} className="rounded-2xl border border-border p-6 landing-surface-card-soft">
              <h2 className="text-xl font-semibold tracking-tight">{resource.intent}</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{resource.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/85">
                {resource.proofPoints.slice(0, 2).map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
              <Link
                href={getPublicResourcePath(resource.slug)}
                className="mt-6 inline-flex items-center text-sm font-semibold text-primary"
              >
                Ler conteúdo completo
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/subscribe" className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-primary-cta">
            Ver assinatura
          </Link>
          <Link href="/privacy-policy" className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-secondary-cta">
            Política de Privacidade
          </Link>
          <Link href="/terms" className="rounded-2xl px-6 py-3.5 text-sm font-semibold landing-secondary-cta">
            Termos de Uso
          </Link>
        </div>
      </section>
    </main>
  )
}
