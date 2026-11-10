import Link from "next/link"
import Image from "next/image"
import { Heart } from "lucide-react"

type FooterLink = {
  label: string
  href: string
}

const legalLinks: FooterLink[] = [
  { label: "Política de Privacidade", href: "/privacy-policy" },
  { label: "Termos de Uso", href: "/terms" },
  { label: "Política de Cookies", href: "/cookies" },
]

const currentYear = 2026

const linkClassName =
  "inline-flex min-h-11 items-center text-sm text-landing-footer-muted transition-colors hover:text-[var(--landing-invert)] focus-visible:outline-none focus-visible:text-[var(--landing-invert)]"

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex min-h-11 w-fit items-center gap-2.5">
              <Image
                src="/corretor-studio-icon.svg"
                alt="Corretor Studio"
                width={34}
                height={34}
                className="size-8 rounded-full"
              />
              <span className="font-display text-lg font-bold tracking-tight">Corretor Studio</span>
            </Link>
            <p className="max-w-sm text-sm leading-6 text-landing-footer-muted">
              O sistema de vendas completo para corretores de planos de saúde e seguros.
            </p>
          </div>

          <nav aria-label="Documentos legais">
            <ul className="flex flex-wrap gap-x-8 gap-y-1">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-landing-footer-line pt-6 text-sm text-landing-footer-subtle md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p>© {currentYear} Corretor Studio. Todos os direitos reservados.</p>
            <p>Studio Marketing e Tecnologia LTDA, CNPJ 68.647.473/0001-19</p>
          </div>
          <p className="inline-flex flex-wrap items-center gap-1.5">
            Developing with
            <Heart aria-hidden className="size-3.5 fill-semantic-success text-semantic-success" />
            by{" "}
            <a
              href="https://willockshouse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-medium text-landing-footer-muted underline-offset-4 transition-colors hover:text-[var(--landing-invert)] hover:underline"
            >
              Willocks House
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
