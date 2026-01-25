"use client"

import Link from "next/link";
import { LandingHeader } from "@/components/landing/landingHeader";

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 40% at 20% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 60%), radial-gradient(30% 20% at 100% 10%, color-mix(in oklab, var(--chart-2) 15%, transparent) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-5xl px-6 sm:px-8 lg:px-10 py-12 md:py-16">
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border p-6 shadow-xl backdrop-blur"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 75%, transparent)",
              }}
            >
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Política de Cookies
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Última atualização: 27/01/2026
              </p>
              <p className="mt-4 text-base text-muted-foreground">
                Esta página explica como usamos cookies e tecnologias similares no Corretor Studio.
              </p>
            </div>

            <div className="grid gap-6">
              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">1. O que são cookies</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Cookies são pequenos arquivos de texto armazenados no seu dispositivo para
                  garantir o funcionamento do serviço e melhorar sua experiência.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">2. Como usamos</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Autenticação e segurança da sessão.</li>
                  <li>Preferências de interface e idioma.</li>
                  <li>Métricas de uso e melhoria contínua.</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">3. Gerenciar cookies</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Você pode limpar ou bloquear cookies nas configurações do seu navegador.
                  Algumas funcionalidades podem não funcionar corretamente se os cookies forem desativados.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">4. Contato</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Dúvidas? Fale conosco em{" "}
                  <a className="text-primary underline underline-offset-4" href="mailto:suporte@corretorstudio.com">
                    suporte@corretorstudio.com
                  </a>
                  .
                </p>
              </article>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link className="underline underline-offset-4" href="/privacy-policy">
                Política de Privacidade
              </Link>
              <span>•</span>
              <Link className="underline underline-offset-4" href="/terms">
                Termos de Uso
              </Link>
              <span>•</span>
              <Link className="underline underline-offset-4" href="/">
                Voltar para a home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
