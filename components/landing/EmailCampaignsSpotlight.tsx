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

const plans = [
  { name: "Starter", credits: "1.000", price: "R$ 25", overage: "R$ 3,50/100" },
  { name: "Plus", credits: "5.000", price: "R$ 100", overage: "R$ 3,00/100" },
  { name: "Pro", credits: "10.000", price: "R$ 175", overage: "R$ 2,50/100" },
  { name: "Business", credits: "25.000", price: "R$ 375", overage: "R$ 2,00/100" },
]

const mockStats = [
  { label: "Taxa de abertura", value: "34,2%", color: "var(--primary)" },
  { label: "Cliques", value: "8,7%", color: "var(--chart-2)" },
  { label: "Entregues", value: "99,1%", color: "var(--chart-4)" },
  { label: "Disparados", value: "4.850", color: "var(--chart-1)" },
]

export function EmailCampaignsSpotlight() {
  return (
    <section id="email-campaigns" className="relative py-20 md:py-28 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(50% 40% at 80% 50%, color-mix(in oklab, var(--chart-2) 20%, transparent) 0%, transparent 60%), radial-gradient(30% 30% at 10% 80%, color-mix(in oklab, var(--primary) 15%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        {/* Section label */}
        <MotionDiv
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 30%, var(--border))",
              background: "color-mix(in oklab, var(--primary) 8%, var(--card))",
              color: "var(--primary)",
            }}
          >
            <Mail className="h-3.5 w-3.5" />
            Nova funcionalidade
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
            Email marketing integrado{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              ao seu CRM
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Sem precisar de Mailchimp, ActiveCampaign ou RD Station. Tudo dentro do Corretor Studio.
          </p>
        </MotionDiv>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">

          {/* Left: Mockup card */}
          <MotionDiv
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 lg:mb-0"
          >
            <div
              className="rounded-3xl border p-6 shadow-2xl"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 90%, transparent)",
              }}
            >
              {/* Mock campaign header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in oklab, var(--primary) 15%, transparent)", color: "var(--primary)" }}
                  >
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Campanha de Maio — Planos Empresariais</p>
                    <p className="text-xs text-muted-foreground">Disparado em 06/05/2025 às 09:00</p>
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--chart-4) 20%, transparent)",
                    color: "var(--chart-4)",
                  }}
                >
                  Enviado
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {mockStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: "var(--border)",
                      background: "color-mix(in oklab, var(--background) 60%, transparent)",
                    }}
                  >
                    <div className="text-2xl font-extrabold" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Mock progress bars */}
              <div className="space-y-3">
                {[
                  { label: "Abertos", pct: 34, color: "var(--primary)" },
                  { label: "Clicados", pct: 9, color: "var(--chart-2)" },
                  { label: "Entregues", pct: 99, color: "var(--chart-4)" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{bar.label}</span>
                      <span>{bar.pct}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${bar.pct}%`, background: bar.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MotionDiv>

          {/* Right: Content */}
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
                    className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <benefit.icon className="h-5 w-5" />
                  </MotionDiv>
                  <div>
                    <p className="font-semibold text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{benefit.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="#demo"
              className="group inline-flex items-center gap-2 text-sm font-semibold mb-10 transition-colors"
              style={{ color: "var(--primary)" }}
            >
              Agendar demonstração e conhecer as campanhas
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Credit plans table */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Planos de créditos de email{" "}
                <span className="text-xs font-normal text-muted-foreground">(1 crédito = 1 email disparado)</span>
              </p>
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "color-mix(in oklab, var(--muted) 60%, transparent)", borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plano</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Créditos/mês</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Preço</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Excedente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan, idx) => (
                      <tr
                        key={plan.name}
                        style={{
                          borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                          background: idx % 2 === 0 ? "transparent" : "color-mix(in oklab, var(--muted) 20%, transparent)",
                        }}
                      >
                        <td className="px-4 py-3 font-medium">{plan.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{plan.credits}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--primary)" }}>
                          {plan.price}<span className="text-xs font-normal text-muted-foreground">/mês</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{plan.overage}/emails</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                Planos de crédito contratados separadamente do CRM. Cancele quando quiser.
              </p>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  )
}
