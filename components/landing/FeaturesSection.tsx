"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, Kanban, Users, Zap } from "lucide-react"

const features = [
  {
    icon: Kanban,
    title: "Pipeline Visual Kanban",
    description: "Acompanhe seus leads em tempo real com um quadro Kanban intuitivo. Arraste e solte cards entre as etapas do funil de vendas.",
    benefits: [
      "Visualização clara do status de cada lead",
      "Drag & drop para mover leads entre etapas",
      "Customização completa das fases do pipeline",
      "Filtros inteligentes por operador, data e status"
    ]
  },
  {
    icon: Users,
    title: "Gestão de Operadores",
    description: "Sistema robusto de multi-usuários com permissões diferenciadas para gestores e operadores de vendas.",
    benefits: [
      "Roles: Manager (admin) e Operator (vendedor)",
      "Atribuição automática de leads aos operadores",
      "Dashboard individual para cada vendedor",
      "Histórico completo de ações por usuário"
    ]
  },
  {
    icon: BarChart3,
    title: "Analytics & Métricas",
    description: "Dashboard completo com insights de performance, taxas de conversão e análise de resultados.",
    benefits: [
      "Taxa de conversão por etapa do funil",
      "Ranking de performance dos operadores",
      "Gráficos de evolução temporal",
      "Exportação de relatórios em PDF/Excel"
    ]
  },
  {
    icon: Zap,
    title: "Automação Inteligente",
    description: "Fluxos automatizados para economizar tempo e garantir que nenhum lead seja esquecido.",
    benefits: [
      "Notificações por email e in-app",
      "Lembretes automáticos de follow-up",
      "Templates de mensagens personalizáveis",
      "Integração com WhatsApp e Telegram"
    ]
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(50% 30% at 80% 20%, color-mix(in oklab, var(--chart-1) 15%, transparent) 0%, transparent 60%)",
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
            Tudo que você precisa para{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              vender mais
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Funcionalidades completas para gestão de leads, equipe e resultados — tudo em um só lugar.
          </p>
        </MotionDiv>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {features.map((feature, idx) => (
            <MotionDiv
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative rounded-2xl border p-8 shadow-lg backdrop-blur transition-all hover:shadow-xl"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 80%, transparent)",
              }}
            >
              <div
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110"
                style={{
                  background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <feature.icon className="h-6 w-6" />
              </div>

              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground mb-5">{feature.description}</p>

              <ul className="space-y-2.5">
                {feature.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
