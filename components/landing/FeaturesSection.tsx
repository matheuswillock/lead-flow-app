"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, CalendarDays, Kanban, Mail, Paperclip, Users, Users2 } from "lucide-react"

type Feature = {
  icon: React.ElementType
  title: string
  description: string
  badge?: string
  benefits?: string[]
  size: "large" | "small"
}

const features: Feature[] = [
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
    size: "large",
  },
  {
    icon: CalendarDays,
    title: "Calendário & Reuniões",
    description: "Agenda diária/semanal com agendamentos integrados ao Google Calendar.",
    size: "small",
  },
  {
    icon: Users2,
    title: "Times / Workspaces",
    description: "Separe operações por time e alterne o workspace ativo com um clique.",
    size: "small",
  },
  {
    icon: Mail,
    title: "Campanhas de Email",
    description:
      "Envie campanhas segmentadas para suas listas de contatos com editor visual, agendamento automático e analytics detalhados.",
    badge: "Novo",
    benefits: [
      "Editor visual drag-and-drop (Maily)",
      "Upload de listas via CSV",
      "Agendamento de disparos",
      "Métricas de abertura, clique e entrega",
    ],
    size: "large",
  },
  {
    icon: BarChart3,
    title: "Dashboard & Métricas",
    description: "KPIs, gráficos e indicadores para acompanhar a performance da equipe.",
    size: "small",
  },
  {
    icon: Users,
    title: "Gestão de Operadores",
    description: "Cadastre operadores, defina funções (SDR/Closer) e controle acessos.",
    size: "small",
  },
  {
    icon: Paperclip,
    title: "Anexos por Lead",
    description: "Guarde contratos, imagens e documentos junto ao lead com acesso direto.",
    size: "small",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
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
                background: "linear-gradient(135deg, var(--primary), var(--brand-rose))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              vender mais
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            CRM + email marketing + gestão de equipe em uma plataforma completa para corretores de saúde.
          </p>
        </MotionDiv>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">

          {/* Row 1: Kanban (large, col-span-2) + Calendar (col-span-1) */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="group relative md:col-span-2 rounded-2xl border p-8 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 85%, transparent)",
            }}
          >
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110"
              style={{
                background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Kanban className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[0].title}</h3>
            <p className="text-muted-foreground mb-5">{features[0].description}</p>
            <ul className="space-y-2.5">
              {features[0].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative rounded-2xl border p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 85%, transparent)",
            }}
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
              style={{
                background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[1].title}</h3>
            <p className="text-sm text-muted-foreground">{features[1].description}</p>
          </MotionDiv>

          {/* Row 2: Teams (col-span-1) + Email Campaigns (large, col-span-2) */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="group relative rounded-2xl border p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 85%, transparent)",
            }}
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
              style={{
                background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Users2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[2].title}</h3>
            <p className="text-sm text-muted-foreground">{features[2].description}</p>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group relative md:col-span-2 rounded-2xl border p-8 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 85%, transparent)",
            }}
          >
            {/* Novo badge */}
            <span
              className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Novo
            </span>

            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110"
              style={{
                background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Mail className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[3].title}</h3>
            <p className="text-muted-foreground mb-5">{features[3].description}</p>
            <ul className="space-y-2.5">
              {features[3].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          {/* Row 3: Dashboard + Operators + Attachments */}
          {[features[4], features[5], features[6]].map((feature, idx) => (
            <MotionDiv
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 + idx * 0.08 }}
              className="group relative rounded-2xl border p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 85%, transparent)",
              }}
            >
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
                style={{
                  background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
