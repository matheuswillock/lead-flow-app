"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart2, CalendarClock, CheckCircle2, FileText, Mail, Upload } from "lucide-react"
import Link from "next/link"

const benefits = [
  {
    icon: FileText,
    title: "Templates com editor visual drag-and-drop",
    description: "Crie emails profissionais com o editor Maily ou diretamente em HTML.",
  },
  {
    icon: Upload,
    title: "Importe listas de contatos via CSV",
    description: "Gerencie múltiplas listas, rastreie cancelamentos e bounces automaticamente.",
  },
  {
    icon: CalendarClock,
    title: "Programe campanhas com agendamento automático",
    description: "Defina data e hora de disparo e o sistema envia no momento certo.",
  },
  {
    icon: BarChart2,
    title: "Métricas de abertura, clique e entrega em tempo real",
    description: "Acompanhe a performance de cada campanha com dashboard detalhado.",
  },
]

const mockStats = [
  { label: "Taxa de abertura", value: "34,2%", className: "text-primary" },
  { label: "Cliques", value: "8,7%", className: "text-[var(--chart-2)]" },
  { label: "Entregues", value: "99,1%", className: "text-[var(--chart-4)]" },
  { label: "Disparados", value: "4.850", className: "text-[var(--chart-1)]" },
]

const barStyles = [
  { label: "Abertos", pct: 34, widthClass: "w-[34%]", colorClass: "bg-primary" },
  { label: "Clicados", pct: 9, widthClass: "w-[9%]", colorClass: "bg-[var(--chart-2)]" },
  { label: "Entregues", pct: 99, widthClass: "w-[99%]", colorClass: "bg-[var(--chart-4)]" },
]

export function EmailCampaignsSpotlight() {
  return (
    <section id="email-campaigns" className="relative py-20 md:py-28 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 landing-email-orbs" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold landing-pill-badge">
            <Mail className="h-3.5 w-3.5" />
            Em breve
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Campanhas de email <span className="landing-primary-gradient">em breve no CRM</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Estamos finalizando o modulo para voce criar, agendar e medir campanhas sem sair do Corretor Studio.
          </p>
        </MotionDiv>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
          <MotionDiv
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 lg:mb-0"
          >
            <div className="rounded-3xl p-6 shadow-2xl landing-surface-card">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Preview da experiencia de campanhas</p>
                    <p className="text-xs text-muted-foreground">Lançamento previsto para breve</p>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[color-mix(in_oklab,var(--chart-4)_20%,transparent)] text-[var(--chart-4)]">
                  Preview
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {mockStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border p-4 bg-[color-mix(in_oklab,var(--background)_60%,transparent)]"
                  >
                    <div className={`text-2xl font-extrabold ${stat.className}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {barStyles.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{bar.label}</span>
                      <span>{bar.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-border">
                      <div className={`h-full rounded-full ${bar.widthClass} ${bar.colorClass}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <ul className="space-y-6 mb-8">
              {benefits.map((benefit, idx) => (
                <li key={benefit.title} className="flex items-start gap-4">
                  <MotionDiv
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary"
                  >
                    <benefit.icon className="h-5 w-5" />
                  </MotionDiv>
                  <div>
                    <p className="font-semibold text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {benefit.description} <span className="font-semibold landing-primary-gradient">(em breve)</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="#demo"
              className="group inline-flex items-center gap-2 text-sm font-semibold mb-10 transition-colors text-primary"
            >
              Quero entrar na lista de prioridade
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Disponibilidade de lançamento</p>
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
                <p className="text-base font-semibold text-foreground">Modulo de email em desenvolvimento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Voce pode solicitar acesso antecipado na demonstracao. Avisaremos assim que a funcionalidade for liberada.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    Lista de prioridade para clientes da base
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    Acesso gradual por lotes apos o lancamento
                  </li>
                </ul>
              </div>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}
