import Link from "next/link"
import Image from "next/image"
import { DemoRequestDialogButton } from "./DemoRequestDialog"

type FooterHrefLink = {
  label: string
  href: string
}

type FooterDemoLink = {
  label: string
  action: "demo"
}

type FooterLink = FooterHrefLink | FooterDemoLink

const footerLinks: {
  empresa: { title: string; links: FooterLink[] }
  suporte: { title: string; links: FooterHrefLink[] }
} = {
  empresa: {
    title: "Empresa",
    links: [
      { label: "Plataforma", href: "/#crm" },
      { label: "Como funciona", href: "/#como" },
      { label: "Integrações", href: "/#integ" },
      { label: "Solicitar demonstração", action: "demo" },
    ],
  },
  suporte: {
    title: "Suporte",
    links: [
      { label: "Dúvidas", href: "/#faq" },
      { label: "Entrar", href: "/sign-in" },
      { label: "Política de cookies", href: "/cookies" },
    ],
  },
}

const currentYear = 2026

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-10 border-b border-landing-footer-line pb-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/corretor-studio-icon.svg"
                alt="Corretor Studio"
                width={34}
                height={34}
                className="size-8 rounded-full"
              />
              <span className="text-lg font-bold tracking-tight">Corretor Studio</span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-landing-footer-muted">
              O sistema de vendas completo para corretores de planos de saúde e seguros.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-display text-sm font-semibold text-landing-invert">{footerLinks.empresa.title}</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.empresa.links.map((link) => (
                <li key={link.label}>
                  {"href" in link ? (
                    <Link
                      href={link.href}
                      className="text-sm text-landing-footer-muted transition-colors hover:text-[var(--landing-invert)]"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <DemoRequestDialogButton className="text-left text-sm text-landing-footer-muted transition-colors hover:text-[var(--landing-invert)]">
                      {link.label}
                    </DemoRequestDialogButton>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-display text-sm font-semibold text-landing-invert">{footerLinks.suporte.title}</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.suporte.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-landing-footer-muted transition-colors hover:text-[var(--landing-invert)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-7 text-sm text-landing-footer-subtle md:flex-row md:items-center md:justify-between">
          <p>
            © {currentYear} Corretor Studio. Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/privacy-policy" className="transition-colors hover:text-[var(--landing-invert)]">
              Privacidade
            </Link>
            <span>·</span>
            <Link href="/terms" className="transition-colors hover:text-[var(--landing-invert)]">
              Termos
            </Link>
            <span>·</span>
            <Link href="/cookies" className="transition-colors hover:text-[var(--landing-invert)]">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
