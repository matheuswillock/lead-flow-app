"use client"

import Link from "next/link"
import { LogIn, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export default function LandingSection() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-block h-6 w-6 rounded-md bg-primary" aria-hidden />
            <span>Seu Produto</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-3.5 py-2.5 text-sm font-semibold bg-card text-foreground/90 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
          >
            <LogIn className="h-4 w-4" /> Entrar
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden min-h-[calc(100dvh-4rem)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 landing-hero-orbs" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 py-14 md:py-20 min-h-[calc(100dvh-4rem)] flex items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs sm:text-sm text-muted-foreground shadow-sm backdrop-blur bg-card/60"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Sistema completo para corretores de saúde
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 mx-auto max-w-[26ch] sm:max-w-[30ch] md:max-w-none text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-foreground text-center"
            >
              <span className="md:block">Corretores comuns mandam</span>
              <span className="md:block">
                cotações.{" "}
                <span className="text-primary">Os de Alta</span>
              </span>
              <span className="md:block">
                <span className="text-primary">Performance</span> usam Corretor
              </span>
              <span className="md:block">Studio.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 mx-auto max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground"
            >
              Tudo que você precisa para ter mais eficiência no seu dia a dia vendendo planos de saúde.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-8 flex justify-center"
            >
              <div className="text-center">
                <Link
                  href="#demo"
                  className="group inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 landing-primary-cta"
                >
                  Agendar demonstração
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}
