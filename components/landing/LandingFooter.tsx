"use client"

import { Github, Linkedin, Mail, Twitter } from "lucide-react"
import Link from "next/link"

const footerLinks = {
  product: {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "#features" },
      { label: "Como Funciona", href: "#how-it-works" },
      { label: "Preços", href: "#pricing" },
      { label: "Roadmap", href: "#" }
    ]
  },
  company: {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Carreiras", href: "#" },
      { label: "Contato", href: "#" }
    ]
  },
  resources: {
    title: "Recursos",
    links: [
      { label: "Documentação", href: "#" },
      { label: "API", href: "#" },
      { label: "Central de Ajuda", href: "#" },
      { label: "Status", href: "#" }
    ]
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Termos de Uso", href: "#" },
      { label: "Política de Privacidade", href: "#" },
      { label: "LGPD", href: "#" },
      { label: "Cookies", href: "#" }
    ]
  }
}

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Mail, href: "mailto:contato@leadflow.com", label: "Email" }
]

export function LandingFooter() {
  return (
    <footer className="relative border-t" style={{ borderColor: "var(--border)" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 100%, color-mix(in oklab, var(--primary) 15%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                L
              </div>
              <span className="text-lg font-bold">Lead Flow</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              A plataforma completa para gestão de leads e equipes de vendas.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="h-9 w-9 rounded-lg flex items-center justify-center border transition-all hover:border-primary"
                  style={{
                    borderColor: "var(--border)",
                    background: "color-mix(in oklab, var(--card) 50%, transparent)",
                  }}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div
          className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lead Flow. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>🇧🇷 Feito no Brasil</span>
            <span>•</span>
            <span>🔒 Dados protegidos pela LGPD</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
