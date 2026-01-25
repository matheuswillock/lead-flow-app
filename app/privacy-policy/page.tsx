"use client"

import Link from "next/link";
import { LandingHeader } from "@/components/landing/landingHeader";

export default function PrivacyPolicyPage() {
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
                Política de Privacidade
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Última atualização: 27/01/2026
              </p>
              <p className="mt-4 text-base text-muted-foreground">
                Esta Política de Privacidade explica como o Corretor Studio coleta, usa e
                protege seus dados ao utilizar a plataforma.
              </p>
            </div>

            <div className="grid gap-6">
              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">1. Dados que coletamos</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Dados de cadastro: nome, e-mail, telefone e CPF/CNPJ.</li>
                  <li>Endereço: CEP, endereço, número, bairro, cidade e UF.</li>
                  <li>Dados de leads e agendamentos inseridos por você e sua equipe.</li>
                  <li>Integrações: tokens do Google Calendar e informações de eventos.</li>
                  <li>Dados de cobrança via Asaas (ex.: assinatura e pagamentos).</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">2. Como usamos os dados</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Gerenciar contas, permissões e acesso à plataforma.</li>
                  <li>Organizar leads, atividades e reuniões.</li>
                  <li>Integrar com Google Calendar para criar e cancelar eventos.</li>
                  <li>Processar pagamentos e assinaturas.</li>
                  <li>Melhorar a experiência e a segurança do serviço.</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">3. Compartilhamento</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Compartilhamos dados apenas quando necessário para operar o serviço:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Supabase (autenticação e armazenamento).</li>
                  <li>Google (Calendar e convites de reunião).</li>
                  <li>Asaas (processamento de pagamentos).</li>
                </ul>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">4. Segurança</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Adotamos medidas técnicas e organizacionais para proteger suas informações,
                  incluindo criptografia em trânsito e controle de acesso.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">5. Seus direitos</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Você pode solicitar acesso, correção ou exclusão dos seus dados. Entre em contato
                  pelo e-mail de suporte abaixo.
                </p>
              </article>

              <article className="rounded-2xl border p-6"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
              >
                <h2 className="text-lg font-semibold">6. Contato</h2>
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
