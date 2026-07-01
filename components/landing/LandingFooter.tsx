"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart } from "lucide-react"

const footerLinks = {
  recursos: {
    title: "Recursos",
    links: [
      { label: "CRM para Corretores", href: "/recursos/crm-corretores-saude" },
      { label: "Pipeline Comercial", href: "/recursos/pipeline-planos-saude" },
      { label: "Gestão de Equipe", href: "/recursos/gestao-equipe-comercial" },
      { label: "CRM vs Planilha", href: "/recursos/crm-vs-planilha" },
      { label: "Todos os Recursos", href: "/recursos" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Política de Privacidade", href: "/privacy-policy" },
      { label: "Termos de Uso", href: "/terms" },
      { label: "Política de Cookies", href: "/cookies" },
    ],
  },
}

export function LandingFooter() {
  return (
    <footer className="relative border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10 landing-footer-orb"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/corretor-studio-icon.svg"
                alt="Corretor Studio"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-lg font-bold tracking-tight">Corretor Studio</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm leading-relaxed">
              CRM para corretores de saúde que precisam de mais clareza, mais velocidade e mais conversão.
            </p>
            <p className="text-sm text-muted-foreground inline-flex items-baseline gap-2">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-primary pulsing-heart fill-primary flex-shrink-0 translate-y-[1px]" />
              <span className="font-semibold text-primary">Willock&apos;s House</span>
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">{footerLinks.recursos.title}</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.recursos.links.map((link) => (
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

          <div>
            <h3 className="font-semibold mb-4 text-foreground">{footerLinks.legal.title}</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.legal.links.map((link) => (
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
        </div>

        {/* Bottom */}
        <div
          className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
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
