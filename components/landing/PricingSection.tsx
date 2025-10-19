"use client"

import { div as MotionDiv } from "framer-motion/client"
import { Check, Users, Zap } from "lucide-react"
import Link from "next/link"

const mainFeatures = [
  "Leads ilimitados",
  "Pipeline Kanban completo",
  "Dashboard com analytics",
  "Automações inteligentes",
  "Gestão de operadores",
  "Relatórios personalizados",
  "Suporte via email",
  "Atualizações automáticas"
]

const additionalInfo = [
  {
    icon: Zap,
    title: "Assinatura Base",
    price: "R$ 59,90",
    description: "Valor fixo mensal para acesso à plataforma"
  },
  {
    icon: Users,
    title: "Operadores Adicionais",
    price: "R$ 19,90",
    description: "Por operador adicional na sua equipe"
  }
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(40% 40% at 50% 50%, color-mix(in oklab, var(--primary) 20%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Preços{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              simples e transparentes
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Um único plano com tudo que você precisa. Pague apenas pelo que usar, sem surpresas.
          </p>
        </MotionDiv>

        {/* Plano Principal */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <div
            className="relative rounded-3xl border-2 p-10 shadow-2xl backdrop-blur ring-2 ring-primary ring-opacity-20"
            style={{
              borderColor: "var(--primary)",
              background: "color-mix(in oklab, var(--card) 90%, transparent)",
            }}
          >
            <div
              className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-6 py-2 text-sm font-semibold shadow-lg"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Plano Único
            </div>

            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-2">Lead Flow Professional</h3>
              <p className="text-muted-foreground">
                Tudo que você precisa para gerenciar seu time de vendas
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {additionalInfo.map((info) => (
                <div
                  key={info.title}
                  className="flex items-start gap-4 p-6 rounded-xl border"
                  style={{
                    borderColor: "var(--border)",
                    background: "color-mix(in oklab, var(--card) 50%, transparent)",
                  }}
                >
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <info.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xl font-bold mb-1">{info.title}</div>
                    <div
                      className="text-3xl font-extrabold mb-2"
                      style={{ color: "var(--primary)" }}
                    >
                      {info.price}
                      <span className="text-base text-muted-foreground font-normal">/mês</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{info.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-4 text-center">Tudo incluído no plano:</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {mainFeatures.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      style={{ color: "var(--primary)" }}
                    />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/subscribe"
                className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-semibold shadow-xl transition-all hover:shadow-2xl hover:scale-105"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                Começar Agora
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                Sem contratos de fidelidade • Cancele quando quiser
              </p>
            </div>
          </div>
        </MotionDiv>

        {/* Exemplo de Cálculo */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div
            className="rounded-2xl border p-8 backdrop-blur"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 70%, transparent)",
            }}
          >
            <h4 className="text-xl font-bold mb-4 text-center">Exemplo de cálculo:</h4>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Assinatura base</span>
                <span className="font-semibold">R$ 59,90</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">3 operadores × R$ 19,90</span>
                <span className="font-semibold">R$ 59,70</span>
              </div>
              <div
                className="h-px w-full"
                style={{ background: "var(--border)" }}
              />
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Total mensal</span>
                <span className="font-bold" style={{ color: "var(--primary)" }}>
                  R$ 119,60
                </span>
              </div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Escale sua equipe sem limites de leads. Adicione ou remova operadores a qualquer momento.
            </p>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center text-sm text-muted-foreground"
        >
          <p>💳 Aceitamos PIX, Boleto e Cartão de Crédito</p>
          <p className="mt-2">🔒 Ambiente seguro com criptografia SSL</p>
        </MotionDiv>
      </div>
    </section>
  )
}
