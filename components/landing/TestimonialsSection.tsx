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
    text: "O Corretor Studio transformou minha forma de trabalhar. Antes eu perdia leads no WhatsApp, agora tudo está organizado e consigo acompanhar cada cliente até o fechamento.",
  },
  {
    name: "Mariana Costa",
    role: "Gerente Comercial",
    company: "MedSaúde Corretora",
    avatar: "MC",
    rating: 5,
    text: "Com 5 operadores na equipe, era caótico gerenciar tudo. O Corretor Studio trouxe clareza total: sei exatamente quem está fazendo o quê e nosso fechamento aumentou 40%.",
    featured: true,
  },
  {
    name: "Roberto Mendes",
    role: "Corretor Autônomo",
    company: "RM Seguros",
    avatar: "RM",
    rating: 5,
    text: "Interface limpa, fácil de usar. Não preciso de treinamento complexo. Em 10 minutos já estava operando. O dashboard me mostra exatamente onde preciso melhorar.",
  },
]

const stats = [
  { value: "40%", label: "Aumento médio em conversões" },
  { value: "500+", label: "Corretores ativos" },
  { value: "50k+", label: "Leads gerenciados" },
  { value: "4.9/5", label: "Avaliação média" },
]

export function TestimonialsSection() {
  const featuredTestimonial = testimonials.find((t) => t.featured)!
  const otherTestimonials = testimonials.filter((t) => !t.featured)

  return (
    <section id="testimonials" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(45% 35% at 70% 30%, color-mix(in oklab, var(--brand-purple) 18%, transparent) 0%, transparent 60%)",
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
                background: "linear-gradient(135deg, var(--primary), var(--brand-rose))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              confiam na gente
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja o que nossos usuários dizem sobre a experiência com o Corretor Studio.
          </p>
        </MotionDiv>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((stat, idx) => (
            <MotionDiv
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="text-center rounded-2xl border p-6 shadow-lg backdrop-blur"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 70%, transparent)",
              }}
            >
              <div
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-none"
                style={{ color: "var(--primary)" }}
              >
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
            </MotionDiv>
          ))}
        </div>

        {/* Featured testimonial */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl border p-8 sm:p-10 mb-8 overflow-hidden"
          style={{
            borderColor: "color-mix(in oklab, var(--primary) 25%, var(--border))",
            background: "color-mix(in oklab, var(--primary) 5%, var(--card))",
          }}
        >
          {/* Background quote decoration */}
          <Quote
            className="absolute -top-2 -left-2 h-20 w-20 opacity-[0.07]"
            style={{ color: "var(--primary)" }}
          />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: featuredTestimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" style={{ color: "var(--primary)" }} />
                ))}
              </div>
              <blockquote className="text-lg sm:text-xl italic leading-relaxed text-foreground">
                &ldquo;{featuredTestimonial.text}&rdquo;
              </blockquote>
            </div>

            <div className="flex md:flex-col items-center md:items-end gap-4 md:gap-2 flex-shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full font-bold text-base"
                style={{
                  background: "color-mix(in oklab, var(--primary) 20%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {featuredTestimonial.avatar}
              </div>
              <div className="md:text-right">
                <div className="font-semibold">{featuredTestimonial.name}</div>
                <div className="text-sm text-muted-foreground">{featuredTestimonial.role}</div>
                <div className="text-xs text-muted-foreground">{featuredTestimonial.company}</div>
              </div>
            </div>
          </div>
        </MotionDiv>

        {/* Other testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {otherTestimonials.map((testimonial, idx) => (
            <MotionDiv
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative rounded-2xl border p-7 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 80%, transparent)",
              }}
            >
              <Quote
                className="absolute top-5 right-5 h-7 w-7 opacity-10"
                style={{ color: "var(--primary)" }}
              />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" style={{ color: "var(--primary)" }} />
                ))}
              </div>

              <p className="text-muted-foreground leading-relaxed mb-6">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 18%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-sm">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.company}</div>
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
