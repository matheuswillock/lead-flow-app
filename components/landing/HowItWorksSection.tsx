"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, CheckCircle2, Filter, Target, TrendingUp, UserPlus } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    title: "1. Capture Leads",
    description: "Adicione leads manualmente ou via integração com formulários externos. Todos os dados organizados em um só lugar.",
    color: "var(--chart-1)"
  },
  {
    icon: Filter,
    title: "2. Organize no Pipeline",
    description: "Leads automaticamente aparecem no quadro Kanban. Defina suas etapas personalizadas: Novo, Contato, Proposta, Fechamento.",
    color: "var(--chart-2)"
  },
  {
    icon: Target,
    title: "3. Acompanhe Visualmente",
    description: "Arraste e solte cards conforme avança no processo de venda. Veja o status de cada negociação em tempo real.",
    color: "var(--chart-3)"
  },
  {
    icon: TrendingUp,
    title: "4. Analise & Otimize",
    description: "Dashboard com métricas completas: taxa de conversão, tempo médio por etapa, performance de operadores e mais.",
    color: "var(--chart-4)"
  },
  {
    icon: CheckCircle2,
    title: "5. Feche Mais Vendas",
    description: "Com processos claros e automações inteligentes, sua equipe foca no que importa: vender mais e melhor.",
    color: "var(--primary)"
  }
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(50% 35% at 20% 50%, color-mix(in oklab, var(--chart-3) 18%, transparent) 0%, transparent 60%)",
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
            Como funciona o{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Lead Flow
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Um fluxo simples e visual para transformar leads em clientes de forma consistente.
          </p>
        </MotionDiv>

        <div className="relative">
          {/* Connection line - desktop only */}
          <div
            className="hidden lg:block absolute left-[60px] top-[60px] bottom-[60px] w-0.5 opacity-20"
            style={{ background: "var(--border)" }}
          />

          <div className="space-y-12">
            {steps.map((step, idx) => (
              <MotionDiv
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative"
              >
                <div className="flex items-start gap-6">
                  <div
                    className="relative z-10 flex h-[120px] w-[120px] flex-shrink-0 items-center justify-center rounded-2xl shadow-lg backdrop-blur transition-transform hover:scale-105"
                    style={{
                      background: `color-mix(in oklab, ${step.color} 15%, var(--card))`,
                      border: `1px solid color-mix(in oklab, ${step.color} 30%, transparent)`,
                    }}
                  >
                    <step.icon className="h-12 w-12" style={{ color: step.color }} />
                  </div>

                  <div className="flex-1 pt-4">
                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                    <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                      {step.description}
                    </p>

                    {idx < steps.length - 1 && (
                      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4" style={{ color: step.color }} />
                        <span>Próximo passo</span>
                      </div>
                    )}
                  </div>
                </div>
              </MotionDiv>
            ))}
          </div>
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-center"
        >
          <div
            className="inline-block rounded-2xl border px-8 py-6 shadow-lg backdrop-blur"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 80%, transparent)",
            }}
          >
            <p className="text-lg font-semibold mb-2">
              Pronto para simplificar sua gestão de leads?
            </p>
            <p className="text-muted-foreground mb-4">
              Comece gratuitamente e veja resultados em poucos dias
            </p>
            <a
              href="/subscribe"
              className="cursor-pointer inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold shadow-lg transition-all hover:shadow-xl"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Começar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </div>
        </MotionDiv>
      </div>
    </section>
  )
}
