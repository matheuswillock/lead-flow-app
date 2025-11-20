"use client"

import { LandingHeader } from "@/components/landing/landingHeader";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { div as MotionDiv, h1 as MotionH1, p as MotionP } from "framer-motion/client";
import { ArrowRight } from "lucide-react";
import { HeartIcon } from "@/components/ui/heart"
// import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 20% 0%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 60%), radial-gradient(30% 20% at 100% 10%, color-mix(in oklab, var(--chart-2) 18%, transparent) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 py-14 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
            <MotionDiv
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <figure
                className="relative rounded-2xl border shadow-xl backdrop-blur overflow-hidden"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in oklab, var(--card) 70%, transparent)",
                }}
              >
                <div className="relative aspect-[4/3] w-full">
                  <img
                    src="/images/product-banner.svg"
                    alt="Interface do produto"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).src = "/window.svg"
                    }}
                  />
                </div>
              </figure>
            </MotionDiv>

            <div>
              <MotionDiv
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs sm:text-sm text-muted-foreground shadow-sm backdrop-blur"
                style={{ background: "color-mix(in oklab, var(--card) 60%, transparent)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
                Lançamento — experiência mais rápida e clara
              </MotionDiv>

              <MotionH1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-5 text-2xl sm:text-4xl md:text-5xl font-extrabold leading-14 tracking-tight"
                style={{
                  background:
                    "linear-gradient(180deg, var(--foreground), color-mix(in oklab, var(--foreground) 80%, transparent))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Apresente, gerencie e cresça — em um único lugar.
              </MotionH1>

              <MotionP
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-3 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground leading-6"
              >
                Uma plataforma elegante e objetiva para automatizar seu fluxo e encantar clientes.
                Simples de começar, poderosa para escalar.
              </MotionP>

              <MotionDiv
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8 flex justify-end"
              >
                <button
                  onClick={async () => {
                    // Verificar se usuário já está logado
                    try {
                      const sb = createSupabaseBrowser();
                      const { data: { user } } = await (sb?.auth.getUser() || { data: { user: null } });
                      if (user?.id) {
                        // Se já logado, vai direto para subscribe
                        window.location.href = "/subscribe";
                        return;
                      }
                    } catch (_) {/* ignore */}
                    // Se não logado, vai para sign-up (que depois vai para subscribe)
                    window.location.href = "/sign-up";
                  }}
                  className="cursor-pointer group inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    boxShadow:
                      "0 10px 25px -10px color-mix(in oklab, var(--primary) 55%, transparent)",
                  }}
                >
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </MotionDiv>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Pricing Section */}
      <PricingSection />

      {/* Simple Footer */}
      <footer className="relative border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.</p>
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
    </main>
  )
}
