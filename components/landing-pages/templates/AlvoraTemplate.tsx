"use client"

import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import {
  PublicTrackingBody,
  type PublicTrackingScriptsValue,
} from "@/components/public-tracking/PublicTrackingScripts"
import { hasPublishableSection } from "@/lib/landing-pages/publishable"
import { LandingPageRenderer } from "../LandingPageRenderer"
import { CookieConsent } from "../imported-sources/black-and-white-components/cookie-consent"

export function AlvoraTemplate({
  snapshot,
  tracking,
}: {
  snapshot: LandingPageSnapshot
  tracking: PublicTrackingScriptsValue | null
}) {
  const config = snapshot.content.templateConfig
  const hero = config?.hero
  const statistics =
    config?.sections?.statistics?.items?.filter(
      (item) => item.value !== 0 && item.value !== "0" && Boolean(item.value),
    ) ?? []
  const operators = config?.sections?.operators?.items ?? []
  const whatsapp = config?.contact.whatsappE164
    ? `https://wa.me/${config.contact.whatsappE164}${config.contact.whatsappMessage ? `?text=${encodeURIComponent(config.contact.whatsappMessage)}` : ""}`
    : "#contact"
  return (
    <main className="alvora-template">
      <header>
        <PublicTrackingBody tracking={tracking} position="start" />
        <a href="#top">
          {config?.identity.logoUrl ? (
            <img src={config.identity.logoUrl} alt={config.identity.tradeName} />
          ) : (
            <>
              <span>corretora</span>
              <b>{config?.identity.tradeName}</b>
            </>
          )}
        </a>
        <a href={config?.contact.phoneE164 ? `tel:${config.contact.phoneE164}` : "#contact"}>
          {config?.contact.phoneDisplay}
        </a>
        <a href={whatsapp}>WhatsApp</a>
      </header>
      <section id="top" className="alvora-hero">
        {config?.media?.hero?.url && (
          <img src={config.media.hero.url} alt={config.media.hero.alt ?? ""} />
        )}
        <div>
          <p>{hero?.eyebrow}</p>
          <h1>{hero?.title}</h1>
          <p>{hero?.description}</p>
          <a href="#contact">{hero?.primaryCta ?? snapshot.form.ctaLabel}</a>
        </div>
      </section>
      {hasPublishableSection(config?.sections?.operators) && operators.length > 0 && (
        <section className="alvora-operators">
          {operators.map(
            (operator) =>
              operator.imageUrl && (
                <img key={operator.title} src={operator.imageUrl} alt={operator.title} />
              ),
          )}
        </section>
      )}
      {hasPublishableSection(config?.sections?.statistics) && statistics.length > 0 && (
        <section className="alvora-stats">
          {statistics.map((item) => (
            <div key={item.title}>
              <strong>{item.value}</strong>
              <span>{item.title}</span>
            </div>
          ))}
        </section>
      )}
      {hasPublishableSection(config?.sections?.differentials) &&
      config?.sections?.differentials?.items?.length ? (
        <section>
          <h2>{config.sections.differentials.title}</h2>
          <div className="alvora-grid">
            {config.sections.differentials.items.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section id="contact" className="alvora-contact">
        <LandingPageRenderer
          snapshot={{ ...snapshot, templateSlug: "cotacao-corretor-studio" }}
          formOnly
        />
      </section>
      <footer>{config?.identity.copyright ?? config?.identity.tradeName}</footer>
      <CookieConsent />
      <PublicTrackingBody tracking={tracking} position="end" />
    </main>
  )
}
