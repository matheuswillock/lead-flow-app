"use client"

import Link from "next/link";
import { LandingHeader } from "@/components/landing/landingHeader";

export default function TermsPage() {
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
                Termos de Uso
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Última atualização: 27/01/2026
              </p>
              <p className="mt-4 text-base text-muted-foreground">
                Ao utilizar o Corretor Studio, você concorda com estes Termos de Uso.
              </p>
            </div>

            <div className="grid gap-6">
              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">1. Sobre o serviço</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  O Corretor Studio é uma plataforma de gestão de leads, atividades e reuniões,
                  incluindo integração com Google Calendar e recursos de automação.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">2. Conta e acesso</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Você é responsável por manter suas credenciais seguras.</li>
                  <li>É proibido compartilhar acesso de forma indevida.</li>
                  <li>Podemos suspender contas em caso de uso irregular.</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">3. Assinatura e pagamentos</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  As assinaturas são processadas via Asaas. O acesso pode ser suspenso
                  em caso de inadimplência, conforme o plano contratado.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">4. Uso aceitável</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Não utilizar a plataforma para fins ilícitos.</li>
                  <li>Não violar direitos de terceiros.</li>
                  <li>Não tentar acessar dados de outros usuários.</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">5. Limitação de responsabilidade</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  O Corretor Studio oferece o serviço “como está” e não se responsabiliza
                  por perdas indiretas ou uso inadequado da plataforma.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">6. Privacidade</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  O tratamento de dados segue nossa{" "}
                  <Link className="text-primary underline underline-offset-4" href="/privacy-policy">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </article>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link className="underline underline-offset-4" href="/privacy-policy">
                Política de Privacidade
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
