import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, TrendingUp, Users } from "lucide-react"
import { LandingHeader } from "@/components/landing/landingHeader"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { EmailCampaignsSpotlight } from "@/components/landing/EmailCampaignsSpotlight"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { HomeClientRuntime } from "@/components/landing/HomeClientRuntime"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const homeTitle = "Corretor Studio | CRM e Marketing para Corretores de Saúde"
const homeDescription =
  "CRM para corretores de saúde. Pipeline Kanban, gestão de equipe, agenda e métricas para aumentar conversão. Campanhas de email em breve."

export const metadata: Metadata = createPublicPageMetadata({
  title: homeTitle,
  description: homeDescription,
  canonicalPath: "/",
  keywords: [
    "crm para corretores de saude",
    "pipeline comercial planos de saude",
    "gestao de leads corretora",
    "software para corretor de saude",
    "corretor studio",
  ],
})

export default function HomePage() {
  const websiteUrl = getAbsoluteUrl("/")
  const logoUrl = getAbsoluteUrl("/corretor-studio-icon.svg")

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Corretor Studio",
    url: websiteUrl,
    inLanguage: "pt-BR",
    description: homeDescription,
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Corretor Studio",
    url: websiteUrl,
    logo: logoUrl,
  }

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Corretor Studio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    url: websiteUrl,
    description:
      "Plataforma de gestão de leads para corretores de saúde com CRM, pipeline comercial, times e agendamento de reuniões. Campanhas de email em breve.",
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "O Corretor Studio e indicado para qual tipo de corretor?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A plataforma foi desenhada para corretores e equipes comerciais que atuam com planos de saude e precisam de mais controle de funil e conversao.",
        },
      },
      {
        "@type": "Question",
        name: "O Corretor Studio substitui planilhas de leads?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. O objetivo e centralizar o processo comercial com rastreabilidade, ownership de leads e indicadores para decisao.",
        },
      },
      {
        "@type": "Question",
        name: "Existe suporte em portugues e foco no mercado brasileiro?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. O produto foi pensado para o contexto de operacao comercial no Brasil e oferece suporte em PT-BR.",
        },
      },
    ],
  }

  return (
    <main className="landing-page min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <LandingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 landing-hero-dot-grid" />
        <div aria-hidden className="pointer-events-none absolute inset-0 landing-hero-orbs" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 landing-hero-fade" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16 md:py-20 min-h-[calc(100dvh-4rem)] flex items-center">
          <div className="w-full lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center">

            {/* Left: Text content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">

              {/* Announcement badge */}
              <Link
                href="#email-campaigns"
                className="group mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:border-primary/40 landing-pill-badge"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-primary" />
                <span className="font-semibold text-primary">Em breve</span>
                <span className="text-muted-foreground">Campanhas de Email no Corretor Studio</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-extrabold leading-[1.1] tracking-tight text-foreground">
                <span className="block">Feche mais planos</span>
                <span className="block">de saúde com o</span>
                <span className="block">
                  <span className="landing-primary-gradient">
                    CRM certo
                  </span>
                  {" "}para o seu time.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
                Pipeline Kanban, gestão de times e métricas em tempo real em uma plataforma feita para corretores de planos de saúde. Campanhas de email chegam{" "}
                <span className="font-semibold landing-primary-gradient">em breve.</span>
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link
                  href="#demo"
                  className="cursor-pointer group inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold shadow-xl w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 transition-all hover:scale-[1.02] landing-primary-cta"
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

            </div>

            {/* Right: Product visual */}
            <div className="hidden lg:flex lg:col-span-5 items-center justify-center mt-12 lg:mt-0">
              <div className="relative w-full max-w-lg">
                {/* Floating badge top-left */}
                <div
                  className="absolute -top-4 -left-4 z-10 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 shadow-lg backdrop-blur text-sm font-semibold landing-hero-floating"
                >
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>+40% conversão média</span>
                </div>

                {/* Product image */}
                <div
                  className="rounded-3xl overflow-hidden shadow-2xl landing-hero-floating"
                >
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
                <div
                  className="absolute -bottom-4 -right-4 z-10 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 shadow-lg backdrop-blur text-sm font-semibold landing-hero-floating"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span>500+ corretores ativos</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* <LogoBar /> */}

      <FeaturesSection />

      <EmailCampaignsSpotlight />

      <HowItWorksSection />

      {/* <TestimonialsSection /> */}

      <PricingSection />

      <LandingFooter />

      <HomeClientRuntime />
    </main>
  )
}
