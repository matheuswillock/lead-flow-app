"use client"

import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

export function BlackAndWhiteTemplate({ snapshot }: { snapshot: LandingPageSnapshot }) {
  const config = snapshot.content.templateConfig
  const hero = config?.hero
  const situations = config?.sections?.situations?.items ?? []
  const faq = config?.sections?.faq
  const formHref = "#landing-form"
  return <main className="bw-template">
    <header><a href="#top">{config?.identity.logoUrl ? <img src={config.identity.logoUrl} alt={config.identity.tradeName} /> : config?.identity.tradeName}</a><a href={formHref}>{hero?.primaryCta ?? snapshot.form.ctaLabel}</a></header>
    <section id="top" className="bw-hero"><p>{hero?.eyebrow}</p><h1>{hero?.title}</h1><p>{hero?.description}</p><a href={formHref}>{hero?.primaryCta ?? snapshot.form.ctaLabel}</a></section>
    {situations.length > 0 && <section><h2>{config?.sections?.situations?.title}</h2><div className="bw-grid">{situations.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p><a href={formHref}>Entender meu cenário</a></article>)}</div></section>}
    {config?.sections?.process?.enabled !== false && <section><h2>{config?.sections?.process?.title}</h2><p>{config?.sections?.process?.description}</p></section>}
    <section id="landing-form" className="bw-form"><h2>{snapshot.form.name}</h2><TemplateFields snapshot={snapshot} /></section>
    {faq?.enabled !== false && faq?.items?.length ? <section><h2>{faq.title}</h2>{faq.items.map((item) => <details key={item.title}><summary>{item.title}</summary><p>{item.description}</p></details>)}</section> : null}
    <footer>{config?.identity.copyright ?? config?.identity.tradeName}</footer>
  </main>
}

function TemplateFields({ snapshot }: { snapshot: LandingPageSnapshot }) { return <a className="bw-submit" href={`/forms/${snapshot.publicId}`}>{snapshot.form.ctaLabel}</a> }
