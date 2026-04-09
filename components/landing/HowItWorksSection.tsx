"use client"

import { div as MotionDiv } from "framer-motion/client"
import { BarChart3, CalendarDays, Filter, UserPlus, Users2 } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Capture Leads",
    description: "Adicione leads manualmente ou via integração com formulários externos.",
    color: "var(--chart-1)",
  },
  {
    number: "02",
    icon: Filter,
    title: "Organize no Pipeline",
    description: "Leads aparecem no Kanban. Defina etapas: Novo, Contato, Proposta, Fechamento.",
    color: "var(--chart-2)",
  },
  {
    number: "03",
    icon: CalendarDays,
    title: "Agende Reuniões",
    description: "Marque reuniões direto do lead com integração ao Google Calendar.",
    color: "var(--chart-3)",
  },
  {
    number: "04",
    icon: Users2,
    title: "Trabalhe em Times",
    description: "Separe operações por time, gerencie funções SDR/Closer por workspace.",
    color: "var(--chart-4)",
  },
  {
    number: "05",
    icon: BarChart3,
    title: "Analise & Cresça",
    description: "Acompanhe métricas e indicadores para tomar decisões rápidas.",
    color: "var(--primary)",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
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
                background: "linear-gradient(135deg, var(--primary), var(--brand-rose))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Corretor Studio
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Um fluxo simples e visual para transformar leads em clientes de forma consistente.
          </p>
        </MotionDiv>

        {/* Desktop: horizontal timeline */}
        <div className="hidden lg:block relative">
          {/* Connector line */}
          <div
            className="absolute left-0 right-0 h-px opacity-20 top-[3.5rem]"
            style={{ background: "var(--border)" }}
            aria-hidden
          />

          <div className="grid grid-cols-5 gap-4">
            {steps.map((step, idx) => (
              <MotionDiv
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex flex-col items-center text-center px-2"
              >
                {/* Number + icon circle */}
                <div className="relative mb-5">
                  <span
                    className="absolute -top-5 left-1/2 -translate-x-1/2 text-5xl font-extrabold leading-none select-none"
                    style={{ color: step.color, opacity: 0.15 }}
                  >
                    {step.number}
                  </span>
                  <div
                    className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                    style={{
                      background: `color-mix(in oklab, ${step.color} 15%, var(--card))`,
                      border: `1px solid color-mix(in oklab, ${step.color} 30%, transparent)`,
                    }}
                  >
                    <step.icon className="h-6 w-6" style={{ color: step.color }} />
                  </div>
                </div>

                <h3 className="text-base font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </MotionDiv>
            ))}
          </div>
        </div>

        {/* Mobile: vertical list */}
        <div className="lg:hidden space-y-8">
          {steps.map((step, idx) => (
            <MotionDiv
              key={step.number}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="flex items-start gap-5"
            >
              {/* Number circle */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg font-extrabold text-sm"
                  style={{
                    background: `color-mix(in oklab, ${step.color} 15%, var(--card))`,
                    border: `1px solid color-mix(in oklab, ${step.color} 30%, transparent)`,
                    color: step.color,
                  }}
                >
                  {step.number}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className="w-px flex-1 mt-2 min-h-[2rem] opacity-20"
                    style={{ background: "var(--border)" }}
                  />
                )}
              </div>

              <div className="pt-2 pb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <step.icon className="h-4 w-4" style={{ color: step.color }} />
                  <h3 className="text-lg font-bold">{step.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
