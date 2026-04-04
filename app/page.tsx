import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { LandingHeader } from "@/components/landing/landingHeader"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { HomeClientRuntime } from "@/components/landing/HomeClientRuntime"
import { HeartIcon } from "@/components/ui/heart"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const homeTitle = "Corretor Studio | Gestão de Leads para Corretores de Saúde"
const homeDescription =
  "CRM para corretores de saúde com pipeline Kanban, gestão de equipe, agenda de reuniões e métricas para aumentar conversão."

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
      "Plataforma de gestão de leads para corretores de saúde com CRM, pipeline comercial, times e agendamento de reuniões.",
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

      <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 20% 0%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 60%), radial-gradient(30% 20% at 100% 10%, color-mix(in oklab, var(--chart-2) 18%, transparent) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mt-8 mx-auto max-w-8xl px-6 sm:px-8 lg:px-10 py-14 md:py-20 min-h-[calc(100dvh-4rem)] flex items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <div
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs sm:text-sm text-muted-foreground shadow-sm backdrop-blur"
              style={{ background: "color-mix(in oklab, var(--card) 60%, transparent)" }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              CRM completo para corretores de saúde
            </div>

            <h1 className="mt-5 mx-auto max-w-[26ch] sm:max-w-[30ch] md:max-w-none text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground text-center">
              <span className="md:block">Corretores comuns mandam</span>
              <span className="md:block">
                cotações. <span className="text-primary">Os de Alta</span>
              </span>
              <span className="md:block">
                <span className="text-primary">Performance</span> usam Corretor
              </span>
              <span className="md:block">Studio.</span>
            </h1>

            <p className="mt-8 mx-auto max-w-3xl text-base sm:text-lg md:text-xl text-muted-foreground leading-7">
              O Corretor Studio é um sistema de gestão de leads para corretores de saúde com
              pipeline Kanban, controle de reuniões, gestão de equipe e indicadores para aumentar
              conversão em vendas.
            </p>

            <p className="mt-4 mx-auto max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground leading-6">
              Tudo que você precisa para ter mais eficiência no seu dia a dia vendendo planos de
              saúde.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="#demo"
                className="cursor-pointer group inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  boxShadow:
                    "0 10px 25px -10px color-mix(in oklab, var(--primary) 55%, transparent)",
                }}
              >
                Agendar demonstração
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div data-nosnippet>
        <FeaturesSection />
      </div>

      <div data-nosnippet>
        <HowItWorksSection />
      </div>

      <div data-nosnippet>
        <PricingSection />
      </div>

      <footer className="relative border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <Link className="underline underline-offset-4" href="/privacy-policy">
                Política de Privacidade
              </Link>
              <Link className="underline underline-offset-4" href="/terms">
                Termos de Uso
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span>Made with</span>
              <HeartIcon style={{ color: "var(--primary)" }} />
              <span className="font-semibold" style={{ color: "var(--primary)" }}>
                Willock's House
              </span>
            </div>
          </div>
        </div>
      </footer>

      <HomeClientRuntime />
    </main>
  )
}
