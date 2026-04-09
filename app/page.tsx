import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle2, TrendingUp, Users } from "lucide-react"
import { LandingHeader } from "@/components/landing/landingHeader"
import { LogoBar } from "@/components/landing/LogoBar"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { EmailCampaignsSpotlight } from "@/components/landing/EmailCampaignsSpotlight"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { TestimonialsSection } from "@/components/landing/TestimonialsSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { HomeClientRuntime } from "@/components/landing/HomeClientRuntime"
import { HeartIcon } from "@/components/ui/heart"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const homeTitle = "Corretor Studio | CRM e Marketing para Corretores de Saúde"
const homeDescription =
  "CRM + email marketing para corretores de saúde. Pipeline Kanban, gestão de equipe, campanhas de email, agenda e métricas para aumentar conversão."

export const metadata: Metadata = createPublicPageMetadata({
  title: homeTitle,
  description: homeDescription,
  canonicalPath: "/",
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
      "Plataforma de gestão de leads e marketing para corretores de saúde com CRM, pipeline comercial, campanhas de email, times e agendamento de reuniões.",
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

      <LandingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)]">
        {/* Dot grid background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Gradient overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 15% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 60%), radial-gradient(35% 25% at 100% 5%, color-mix(in oklab, var(--brand-rose) 14%, transparent) 0%, transparent 60%)",
          }}
        />

        {/* Bottom fade to merge with next section */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
          style={{
            background: "linear-gradient(to bottom, transparent, var(--background))",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16 md:py-20 min-h-[calc(100dvh-4rem)] flex items-center">
          <div className="w-full lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center">

            {/* Left: Text content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">

              {/* Announcement badge */}
              <Link
                href="#email-campaigns"
                className="group mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors hover:border-primary/40"
                style={{
                  borderColor: "color-mix(in oklab, var(--primary) 30%, var(--border))",
                  background: "color-mix(in oklab, var(--primary) 8%, var(--card))",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--primary)" }}
                />
                <span style={{ color: "var(--primary)" }} className="font-semibold">Novo</span>
                <span className="text-muted-foreground">Campanhas de Email integradas ao CRM</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-extrabold leading-[1.1] tracking-tight text-foreground">
                <span className="block">Feche mais planos</span>
                <span className="block">de saúde com o</span>
                <span className="block">
                  <span
                    style={{
                      background: "linear-gradient(135deg, var(--primary) 0%, var(--brand-rose) 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    CRM certo
                  </span>
                  {" "}para o seu time.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
                Pipeline Kanban, gestão de times, campanhas de email e métricas em tempo real — tudo em uma plataforma feita para corretores de planos de saúde.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link
                  href="#demo"
                  className="cursor-pointer group inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold shadow-xl w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 transition-all hover:scale-[1.02]"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    boxShadow: "0 12px 28px -8px color-mix(in oklab, var(--primary) 60%, transparent)",
                  }}
                >
                  Agendar demonstração
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <Link
                  href="#how-it-works"
                  className="cursor-pointer inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold border w-full sm:w-auto transition-all hover:bg-muted/50"
                  style={{ borderColor: "var(--border)" }}
                >
                  Ver como funciona
                </Link>
              </div>

              {/* Trust line */}
              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  Sem cartão de crédito
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  Suporte em PT-BR
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  Cancele quando quiser
                </span>
              </div>
            </div>

            {/* Right: Product visual */}
            <div className="hidden lg:flex lg:col-span-5 items-center justify-center mt-12 lg:mt-0">
              <div className="relative w-full max-w-lg">
                {/* Floating badge top-left */}
                <div
                  className="absolute -top-4 -left-4 z-10 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 shadow-lg backdrop-blur text-sm font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--card) 85%, transparent)",
                    borderColor: "var(--border)",
                  }}
                >
                  <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  <span>+40% conversão média</span>
                </div>

                {/* Product image */}
                <div
                  className="rounded-3xl border overflow-hidden shadow-2xl"
                  style={{
                    borderColor: "var(--border)",
                    boxShadow: "0 32px 64px -16px color-mix(in oklab, var(--primary) 20%, rgba(0,0,0,0.3))",
                  }}
                >
                  <Image
                    src="/product-banner.svg"
                    alt="Corretor Studio — pipeline e gestão de leads"
                    width={600}
                    height={400}
                    className="w-full h-auto"
                    priority
                  />
                </div>

                {/* Floating badge bottom-right */}
                <div
                  className="absolute -bottom-4 -right-4 z-10 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 shadow-lg backdrop-blur text-sm font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--card) 85%, transparent)",
                    borderColor: "var(--border)",
                  }}
                >
                  <Users className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  <span>500+ corretores ativos</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <LogoBar />

      <div data-nosnippet>
        <FeaturesSection />
      </div>

      <div data-nosnippet>
        <EmailCampaignsSpotlight />
      </div>

      <div data-nosnippet>
        <HowItWorksSection />
      </div>

      <div data-nosnippet>
        <TestimonialsSection />
      </div>

      <div data-nosnippet>
        <PricingSection />
      </div>

      <footer className="relative border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Col 1: Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight mb-4">
                <Image
                  src="/corretor-studio-icon.svg"
                  alt="Corretor Studio"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                />
                <span>Corretor Studio</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                O CRM e plataforma de email marketing para corretores de planos de saúde de alta performance.
              </p>
              <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Made with</span>
                <HeartIcon style={{ color: "var(--primary)" }} className="h-4 w-4" />
                <span className="font-semibold" style={{ color: "var(--primary)" }}>
                  Willock&apos;s House
                </span>
              </div>
            </div>

            {/* Col 2: Produto */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Produto</h4>
              <nav className="flex flex-col gap-3">
                <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </Link>
                <Link href="/#email-campaigns" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Campanhas de Email
                </Link>
                <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Como funciona
                </Link>
                <Link href="/#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Agendar Demo
                </Link>
              </nav>
            </div>

            {/* Col 3: Legal */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
              <nav className="flex flex-col gap-3">
                <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidade
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Termos de Uso
                </Link>
              </nav>
            </div>

          </div>

          {/* Bottom strip */}
          <div
            className="mt-10 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-muted-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <p>© {new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.</p>
            <p className="text-xs">
              Desenvolvido para corretores de planos de saúde no Brasil
            </p>
          </div>
        </div>
      </footer>

      <HomeClientRuntime />
    </main>
  )
}
