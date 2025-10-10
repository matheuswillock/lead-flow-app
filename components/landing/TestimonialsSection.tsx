"use client"

import { div as MotionDiv } from "framer-motion/client"
import { Quote, Star } from "lucide-react"

const testimonials = [
  {
    name: "Carlos Silva",
    role: "Corretor de Planos de Saúde",
    company: "Vida Plena Corretora",
    avatar: "CS",
    rating: 5,
    text: "O Lead Flow transformou minha forma de trabalhar. Antes eu perdia leads no WhatsApp, agora tudo está organizado e consigo acompanhar cada cliente até o fechamento."
  },
  {
    name: "Mariana Costa",
    role: "Gerente Comercial",
    company: "MedSaúde Corretora",
    avatar: "MC",
    rating: 5,
    text: "Com 5 operadores na equipe, era caótico gerenciar tudo. O Lead Flow trouxe clareza total: sei exatamente quem está fazendo o quê e nosso fechamento aumentou 40%."
  },
  {
    name: "Roberto Mendes",
    role: "Corretor Autônomo",
    company: "RM Seguros",
    avatar: "RM",
    rating: 5,
    text: "Interface limpa, fácil de usar. Não preciso de treinamento complexo. Em 10 minutos já estava operando. O dashboard me mostra exatamente onde preciso melhorar."
  }
]

const stats = [
  { value: "40%", label: "Aumento médio em conversões" },
  { value: "500+", label: "Corretores ativos" },
  { value: "50k+", label: "Leads gerenciados" },
  { value: "4.9/5", label: "Avaliação média" }
]

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(45% 35% at 70% 30%, color-mix(in oklab, var(--chart-4) 18%, transparent) 0%, transparent 60%)",
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
            Corretores que{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--chart-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              confiam na gente
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja o que nossos usuários dizem sobre a experiência com o Lead Flow.
          </p>
        </MotionDiv>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => (
            <MotionDiv
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="text-center rounded-xl border p-6 shadow-lg backdrop-blur"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 70%, transparent)",
              }}
            >
              <div className="text-3xl md:text-4xl font-extrabold" style={{ color: "var(--primary)" }}>
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
            </MotionDiv>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <MotionDiv
              key={testimonial.name}
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
              <Quote
                className="absolute top-6 right-6 h-8 w-8 opacity-10"
                style={{ color: "var(--primary)" }}
              />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-current"
                    style={{ color: "var(--primary)" }}
                  />
                ))}
              </div>

              <p className="text-muted-foreground leading-relaxed mb-6">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full font-semibold text-sm"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 20%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.company}
                  </div>
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
