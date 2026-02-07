"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, CalendarDays, Kanban, Paperclip, Users, Users2 } from "lucide-react"

const features = [
  {
    icon: Kanban,
    title: "Pipeline Kanban + Tabela",
    description:
      "Organize o funil com duas visões: Kanban para mover etapas e tabela para revisar todos os leads.",
    benefits: [
      "Arraste e solte por etapa",
      "Visão em lista com filtros rápidos",
      "Status e responsáveis sempre visíveis",
      "Detalhes completos do lead em um clique",
    ],
  },
  {
    icon: CalendarDays,
    title: "Calendário & Reuniões",
    description: "Agenda diária/semanal com agendamentos integrados ao Google Calendar.",
    benefits: [
      "Agende reuniões direto do lead",
      "Convites com link e participantes",
      "Controle de reuniões realizadas/no-show",
      "Reagendamento e cancelamento centralizados",
    ],
  },
  {
    icon: Users2,
    title: "Times / Workspaces",
    description: "Separe operações por time e alterne o workspace ativo com um clique.",
    benefits: [
      "Múltiplos times por conta",
      "Troca rápida de time ativo",
      "Dados isolados por time",
      "Gestão de membros e permissões",
    ],
  },
  {
    icon: Users,
    title: "Gestão de Operadores",
    description: "Cadastre operadores, defina funções (SDR/Closer) e controle acessos.",
    benefits: [
      "Papéis Manager e Operator",
      "Funções por time",
      "Convites e reenvio de acesso",
      "Controle de usuários pendentes",
    ],
  },
  {
    icon: BarChart3,
    title: "Dashboard & Métricas",
    description: "KPIs, gráficos e indicadores para acompanhar a performance.",
    benefits: [
      "Cards de métricas essenciais",
      "Gráficos por período",
      "Indicadores de reuniões e vendas",
      "Visão rápida do funil",
    ],
  },
  {
    icon: Paperclip,
    title: "Anexos por Lead",
    description: "Guarde contratos, imagens e documentos junto ao lead.",
    benefits: [
      "Upload de PDF e imagens",
      "Lista de anexos com download",
      "Organização centralizada",
      "Acesso direto no card do lead",
    ],
  },
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
            Funcionalidades completas para gestão de leads, equipe, agenda e resultados tudo em um só lugar.
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
