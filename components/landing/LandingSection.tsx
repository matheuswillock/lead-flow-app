"use client"

import Link from "next/link"
import Image from "next/image"
import { LogIn, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export default function LandingSection() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-block h-6 w-6 rounded-md" style={{ background: "var(--primary)" }} aria-hidden />
            <span>Seu Produto</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold bg-card text-foreground/90 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
            style={{ borderColor: "var(--border)" }}
          >
            <LogIn className="h-4 w-4" /> Entrar
          </Link>
        </div>
      </header>

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
            <div>
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs sm:text-sm text-muted-foreground shadow-sm backdrop-blur"
                style={{ background: "color-mix(in oklab, var(--card) 60%, transparent)" }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                Lançamento — experiência mais rápida e clara
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-5 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight"
                style={{
                  background:
                    "linear-gradient(180deg, var(--foreground), color-mix(in oklab, var(--foreground) 80%, transparent))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Apresente, gerencie e cresça — em um único lugar.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-5 max-w-xl text-base sm:text-lg md:text-xl text-muted-foreground"
              >
                Uma plataforma elegante e objetiva para automatizar seu fluxo e encantar clientes.
                Simples de começar, poderosa para escalar.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8"
              >
                <Link
                  href="/subscribe"
                  className="group inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    boxShadow:
                      "0 10px 25px -10px color-mix(in oklab, var(--primary) 55%, transparent)",
                  }}
                >
                  Contratar / Assinar
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-3 text-xs sm:text-sm text-muted-foreground">
                  14 dias grátis • sem cartão • cancele quando quiser
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <figure
                className="relative rounded-2xl border shadow-xl backdrop-blur overflow-hidden"
                style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--card) 70%, transparent)" }}
              >
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src="/images/product-screenshot.png"
                    alt="Interface do produto"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <figcaption
                  className="absolute bottom-0 inset-x-0 p-3 text-center text-xs text-muted-foreground/90"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent, color-mix(in oklab, var(--background) 82%, transparent))",
                  }}
                >
                  Mock da interface — substitua pela sua screenshot real
                </figcaption>
              </figure>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}
