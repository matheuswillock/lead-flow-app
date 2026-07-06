import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CalendarCheck, UserPlus } from "lucide-react"
import { LandingHeader } from "@/components/landing/landingHeader"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { EmailCampaignsSpotlight } from "@/components/landing/EmailCampaignsSpotlight"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { HomeClientRuntime } from "@/components/landing/HomeClientRuntime"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import { featuresData, FEATURES_SECTION_HEADING, FEATURES_SECTION_SUBHEADING } from "@/lib/landing/features-data"
import { howItWorksSteps, HOW_IT_WORKS_HEADING, HOW_IT_WORKS_SUBHEADING } from "@/lib/landing/how-it-works-data"
import { emailBenefitsData, EMAIL_SPOTLIGHT_HEADING, EMAIL_SPOTLIGHT_SUBHEADING } from "@/lib/landing/email-spotlight-data"

const homeTitle = "Corretor Studio | CRM e Marketing para Corretores de Saúde"
const homeDescription =
  "CRM para corretores de saúde com pipeline Kanban, gestão de equipe, agenda e métricas. Agende uma demonstração gratuita e aumente sua conversão."

export const metadata: Metadata = createPublicPageMetadata({
  title: homeTitle,
  description: homeDescription,
  canonicalPath: "/",
})

export default function HomePage() {
  const websiteUrl = getAbsoluteUrl("/")
  const logoUrl = getAbsoluteUrl("/corretor-studio-icon.svg")

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
          "Plataforma de gestão de leads para corretores de saúde com CRM, pipeline comercial, gestão de times e agendamento de reuniões.",
        publisher: { "@id": `${websiteUrl}#organization` },
        featureList: [
          "Pipeline Kanban de leads",
          "CRM para corretores de saúde",
          "Gestão de equipe comercial",
          "Agenda de reuniões",
          "Métricas de conversão",
          "Integrações de captação",
          "Campanhas de e-mail",
        ],
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
        mainEntity: [
          {
            "@type": "Question",
            name: "O Corretor Studio é indicado para qual tipo de corretor?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "O Corretor Studio foi desenvolvido especificamente para corretores e equipes comerciais que atuam com planos de saúde no Brasil — tanto para o corretor individual quanto para corretoras com times estruturados de operadores. Se você lida com captação e qualificação de leads, envio de propostas, follow-up e gestão de renovações, a plataforma foi desenhada para o seu processo. O sistema é especialmente valioso para quem está saindo de planilhas ou de comunicação exclusiva pelo WhatsApp e quer previsibilidade no funil comercial. Cada funcionalidade — pipeline, agenda, métricas, campanhas — foi pensada para a rotina específica de venda e gestão de planos de saúde.",
            },
          },
          {
            "@type": "Question",
            name: "O Corretor Studio substitui planilhas de leads?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim. O objetivo central do Corretor Studio é centralizar o processo comercial com rastreabilidade, ownership de leads e indicadores claros — tudo o que uma planilha não oferece de forma nativa. Com o CRM, cada lead tem um responsável definido, um histórico completo de interações e uma próxima ação registrada. O gestor consegue ver em tempo real onde cada oportunidade está no funil, sem precisar consolidar linhas de planilha. A migração é guiada, com importação dos leads existentes para não perder histórico. Para a maioria das operações, o impacto positivo começa a aparecer na primeira semana de uso.",
            },
          },
          {
            "@type": "Question",
            name: "Existe suporte em português e foco no mercado brasileiro?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sim. O Corretor Studio foi construído exclusivamente para o mercado de planos de saúde no Brasil, e todo o produto, documentação e suporte são em português. As terminologias, fluxos e funcionalidades do sistema refletem a realidade operacional de corretores brasileiros. O suporte atende em PT-BR com conhecimento do setor, o que agiliza a resolução de dúvidas específicas da operação de planos. O produto é atualizado continuamente com base no feedback da base de usuários brasileiros, garantindo que as funcionalidades evoluam conforme as necessidades reais do mercado nacional de saúde suplementar.",
            },
          },
        ],
      },
    ],
  }

  return (
    <main className="landing-page min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graphSchema) }}
      />

      <LandingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 landing-hero-dot-grid"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 landing-hero-orbs" />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 landing-hero-fade"
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16 md:py-20 min-h-[calc(100dvh-4rem)] flex items-center">
          <div className="w-full lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center">
            {/* Left: Text content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
              {/* Announcement badge */}
              <Link
                href="#email-campaigns"
                className="group mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:border-primary/40 landing-pill-badge"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none bg-primary" />
                <span className="font-semibold text-primary">Em breve</span>
                <span className="text-muted-foreground">Campanhas de E-mail no Corretor Studio</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-extrabold leading-[1.1] tracking-tight text-foreground">
                <span className="block text-base sm:text-lg md:text-xl xl:text-2xl font-semibold text-muted-foreground mb-2">
                  Corretores comuns mandam cotações.
                </span>
                <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-foreground">
                  Os de{" "}
                  <span className="inline leading-[0.95] text-primary">
                    ALTA PERFORMANCE
                  </span>
                </span>

                <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-foreground">
                  usam Corretor Studio.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
                Enquanto outros perdem leads no WhatsApp e em planilhas, seu time opera com{" "}
                <span className="text-foreground font-semibold">pipeline</span>
                {", "}
                <span className="text-foreground font-semibold">agenda</span>
                {" e "}
                <span className="text-foreground font-semibold">indicadores</span>{" "}
                tudo em um só lugar para não ficar para trás.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link
                  href="#demo"
                  className="cursor-pointer group inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold shadow-xl w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all hover:scale-[1.02] landing-primary-cta"
                >
                  Agendar demonstração
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <Link
                  href="#how-it-works"
                  className="cursor-pointer inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold w-full sm:w-auto transition-all hover:bg-muted/50 landing-secondary-cta"
                >
                  Ver como funciona
                </Link>
              </div>

              {/* Compact pipeline preview — visible below lg */}
              <div className="mt-10 w-full max-w-sm sm:max-w-md lg:hidden">
                <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-2.5 py-1.5 text-xs font-semibold shadow-sm">
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    <span>Novo lead</span>
                  </div>
                  <Image
                    src="/images/product-banner.svg"
                    alt="Pipeline Kanban do Corretor Studio"
                    width={600}
                    height={400}
                    className="w-full h-auto"
                    priority
                  />
                  <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-2.5 py-1.5 text-xs font-semibold shadow-sm">
                    <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Reunião agendada</span>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Pipeline visual · leads organizados em tempo real
                </p>
              </div>
            </div>

            {/* Right: Product visual */}
            <div className="hidden lg:flex lg:col-span-5 items-center justify-center mt-12 lg:mt-0">
              <div className="relative w-full max-w-lg">
                {/* Floating badge top-left */}
                <div className="absolute -top-4 -left-4 z-10 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-md">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span>Novo lead no pipeline</span>
                </div>

                {/* Product image */}
                <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
                  <Image
                    src="/images/product-banner.svg"
                    alt="Corretor Studio — pipeline e gestão de leads"
                    width={600}
                    height={400}
                    className="w-full h-auto"
                    priority
                  />
                </div>

                {/* Floating badge bottom-right */}
                <div className="absolute -bottom-4 -right-4 z-10 flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-md">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <span>Reunião agendada</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Server-rendered text for SEO indexability — visual rendered by FeaturesSection */}
      <section aria-hidden="true" className="sr-only">
        <h2>{FEATURES_SECTION_HEADING}</h2>
        <p>{FEATURES_SECTION_SUBHEADING}</p>
        {featuresData.map((f) => (
          <div key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
            {f.benefits?.map((b) => <span key={b}>{b}</span>)}
          </div>
        ))}
      </section>
      <FeaturesSection />

      {/* Server-rendered text for SEO indexability — visual rendered by EmailCampaignsSpotlight */}
      <section aria-hidden="true" className="sr-only">
        <h2>{EMAIL_SPOTLIGHT_HEADING}</h2>
        <p>{EMAIL_SPOTLIGHT_SUBHEADING}</p>
        {emailBenefitsData.map((b) => (
          <div key={b.title}>
            <h3>{b.title}</h3>
            <p>{b.description}</p>
          </div>
        ))}
      </section>
      <EmailCampaignsSpotlight />

      {/* Server-rendered text for SEO indexability — visual rendered by HowItWorksSection */}
      <section aria-hidden="true" className="sr-only">
        <h2>{HOW_IT_WORKS_HEADING}</h2>
        <p>{HOW_IT_WORKS_SUBHEADING}</p>
        {howItWorksSteps.map((s) => (
          <div key={s.number}>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </section>
      <HowItWorksSection />

      {/* <TestimonialsSection /> */}

      <PricingSection />

      <LandingFooter />

      <HomeClientRuntime />
    </main>
  )
}
