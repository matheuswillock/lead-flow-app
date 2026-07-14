import type { Metadata } from "next"
import { connection } from "next/server"
import { LandingHeader } from "@/components/landing/landingHeader"
import { LandingHero } from "@/components/landing/LandingHero"
import { OperatorsMarquee } from "@/components/landing/OperatorsMarquee"
import { FeatureCarousel } from "@/components/landing/FeatureCarousel"
import { StatsBand } from "@/components/landing/StatsBand"
import { IntegrationsSection } from "@/components/landing/IntegrationsSection"
import { HowItWorksSteps } from "@/components/landing/HowItWorksSteps"
import { FaqSection } from "@/components/landing/FaqSection"
import { DemoRequestDialogProvider } from "@/components/landing/DemoRequestDialog"
import { FinalCtaSection } from "@/components/landing/FinalCtaSection"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { HomeClientRuntime } from "@/components/landing/HomeClientRuntime"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import { featurePanelsData } from "@/lib/landing/feature-panels-data"
import { faqData } from "@/lib/landing/faq-data"
import { getLandingStats } from "@/lib/landing/public-stats"
import { buildStatsData } from "@/lib/landing/stats-data"

const homeTitle = "Corretor Studio | CRM e Marketing para Corretores de Saúde"
const homeDescription =
  "CRM para corretores de saúde com pipeline Kanban, gestão de equipe, agenda e métricas. Solicite uma demonstração gratuita e aumente sua conversão."

export const metadata: Metadata = createPublicPageMetadata({
  title: homeTitle,
  description: homeDescription,
  canonicalPath: "/",
})

export default async function HomePage() {
  await connection()

  const websiteUrl = getAbsoluteUrl("/")
  const logoUrl = getAbsoluteUrl("/corretor-studio-icon.svg")
  const landingStats = await getLandingStats()
  const statsData = buildStatsData(landingStats)

  const graphSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${websiteUrl}#website`,
        name: "Corretor Studio",
        url: websiteUrl,
        inLanguage: "pt-BR",
        description: homeDescription,
        publisher: { "@id": `${websiteUrl}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${websiteUrl}#organization`,
        name: "Corretor Studio",
        url: websiteUrl,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: "Portuguese",
        },
        sameAs: [],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${websiteUrl}#software`,
        name: "Corretor Studio",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "CRM",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        url: websiteUrl,
        description:
          "Plataforma de gestão de leads para corretores de saúde com CRM, pipeline comercial, gestão de times, campanhas e agendamento de reuniões.",
        publisher: { "@id": `${websiteUrl}#organization` },
        featureList: featurePanelsData.map((feature) => feature.eyebrow),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqData.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graphSchema) }}
      />
      <DemoRequestDialogProvider>
        <main className="landing-page min-h-screen bg-card text-landing-ink">
          <LandingHeader />
          <LandingHero />
          <OperatorsMarquee />
          <FeatureCarousel />
          <StatsBand stats={statsData} />
          <IntegrationsSection />
          <HowItWorksSteps />
          <FaqSection />
          <FinalCtaSection />
          <LandingFooter />
          <HomeClientRuntime />

          <section className="sr-only" aria-label="Resumo da plataforma">
            <h2>CRM para corretores de planos de saúde</h2>
            <p>
              O Corretor Studio reúne pipeline Kanban, carteira, campanhas de e-mail, dashboard,
              times, operadores, integrações e agenda para organizar a rotina comercial de
              corretores de saúde.
            </p>
          </section>
        </main>
      </DemoRequestDialogProvider>
    </>
  )
}
