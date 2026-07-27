import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { DemoRequestDialogButton } from "./DemoRequestDialog"

export function LandingHero() {
  return (
    <section id="top" className="landing-hero relative overflow-hidden pt-36 pb-20 md:pt-44 md:pb-24">
      <div aria-hidden className="landing-hero-blob landing-hero-blob--primary" />
      <div aria-hidden className="landing-hero-blob landing-hero-blob--secondary" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 sm:px-8 min-[920px]:grid-cols-[0.92fr_1.08fr] lg:px-10">
        <div>
          <span className="mb-3 block font-display text-xl font-bold leading-tight tracking-[-0.02em] text-landing-muted md:text-2xl">
            Corretores comuns mandam cotações.
          </span>
          <h1 className="max-w-3xl text-balance font-display text-[clamp(2.4rem,8vw,4.7rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-landing-ink">
            Os de <em className="not-italic text-primary">ALTA PERFORMANCE</em> usam Corretor Studio.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-landing-body md:text-xl">
            Enquanto outros perdem leads no WhatsApp e em planilhas, seu time opera com{" "}
            <strong className="font-bold text-landing-ink">pipeline</strong>,{" "}
            <strong className="font-bold text-landing-ink">Radar</strong>,{" "}
            <strong className="font-bold text-landing-ink">campanhas de e-mail</strong> e{" "}
            <strong className="font-bold text-landing-ink">indicadores</strong> — tudo em um só lugar
            para não ficar para trás.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <DemoRequestDialogButton
              className="landing-primary-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Solicitar demonstração
              <ArrowRight className="size-5" aria-hidden />
            </DemoRequestDialogButton>
            <Link
              href="/#crm"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-landing-ink px-6 py-3 text-base font-semibold text-landing-invert transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Explorar a plataforma
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-landing-muted">
            {["Demo gratuita", "Suporte em português", "Sem instalação"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="landing-product-window">
          <div className="landing-window-bar">
            <span />
            <span />
            <span />
            <p>Corretor Studio · Dashboard</p>
          </div>
          <Image
            src="/images/landing/dashboard-dark.webp"
            alt="Dashboard do Corretor Studio com métricas em tempo real"
            width={1322}
            height={802}
            className="h-auto w-full"
            sizes="(max-width: 1024px) 92vw, 640px"
            priority
            loading="eager"
          />
        </div>
      </div>
    </section>
  )
}
