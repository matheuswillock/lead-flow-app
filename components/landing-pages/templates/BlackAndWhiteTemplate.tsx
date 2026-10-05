"use client"

import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import {
  PublicTrackingBody,
  type PublicTrackingScriptsValue,
} from "@/components/public-tracking/PublicTrackingScripts"
import { hasPublishableSection } from "@/lib/landing-pages/publishable"
import { LandingPageRenderer } from "../LandingPageRenderer"

export function BlackAndWhiteTemplate({
  snapshot,
  tracking,
}: {
  snapshot: LandingPageSnapshot
  tracking: PublicTrackingScriptsValue | null
}) {
  const config = snapshot.content.templateConfig
  const hero = config?.hero
  const situations = config?.sections?.situations?.items ?? []
  const situationsSection = config?.sections?.situations
  const processSection = config?.sections?.process
  const faq = config?.sections?.faq
  const formHref = "#landing-form"
  return (
    <main className="bw-template">
      <header>
        <PublicTrackingBody tracking={tracking} position="start" />
        <a href="#top">
          {config?.identity.logoUrl ? (
            <img src={config.identity.logoUrl} alt={config.identity.tradeName} />
          ) : (
            config?.identity.tradeName
          )}
        </a>
        <a href={formHref}>{hero?.primaryCta ?? snapshot.form.ctaLabel}</a>
      </header>
      <section id="top" className="bw-hero">
        <p>{hero?.eyebrow}</p>
        <h1>{hero?.title}</h1>
        <p>{hero?.description}</p>
        <a href={formHref}>{hero?.primaryCta ?? snapshot.form.ctaLabel}</a>
      </section>
      {hasPublishableSection(situationsSection) && situations.length > 0 && (
        <section>
          <h2>{situationsSection?.title}</h2>
          <div className="bw-grid">
            {situations.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <a href={formHref}>Entender meu cenário</a>
              </article>
            ))}
          </div>
        </section>
      )}
      {hasPublishableSection(processSection) && (
        <section>
          <h2>{processSection?.title}</h2>
          <p>{processSection?.description}</p>
        </section>
      )}
      <section id="landing-form" className="bw-form">
        <LandingPageRenderer
          snapshot={{ ...snapshot, templateSlug: "cotacao-corretor-studio" }}
          formOnly
        />
      </section>
      {hasPublishableSection(faq) && faq?.items?.length ? (
        <section>
          <h2>{faq.title}</h2>
          {faq.items.map((item) => (
            <details key={item.title}>
              <summary>{item.title}</summary>
              <p>{item.description}</p>
            </details>
          ))}
        </section>
      ) : null}
      <footer>{config?.identity.copyright ?? config?.identity.tradeName}</footer>
      <PublicTrackingBody tracking={tracking} position="end" />
    </main>
  )
}
