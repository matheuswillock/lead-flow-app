'use client'

import Link from 'next/link'
const navigation = [['Como funciona', '#processo'], ['Analisar opções', '#analise'], ['Dúvidas frequentes', '#duvidas'], ['Contato', '#analise']]
const socials: { label: string; href: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: string }> }[] = []

export function SiteFooter({ brandName = "Sua marca", legalName = "", cnpj = "", whatsapp = "", email = "", businessHours = "" }: { brandName?: string; legalName?: string; cnpj?: string; whatsapp?: string; email?: string; businessHours?: string }) {
  const digits = (value: string) => value.replace(/\D/g, "")
  const maskPhone = (value: string) => { const normalized = digits(value); return normalized.length === 11 ? `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}` : value }
  const maskCnpj = (value: string) => { const normalized = digits(value); return normalized.length === 14 ? `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}` : value }
  return <footer className="institutional-footer">
    <div className="container">
      <div className="footer-columns">
        <div className="footer-brand-column">
          <Link href="/#top" className="brand footer-brand" aria-label={`${brandName} — início`}>{brandName}</Link>
          <p>Consultoria para quem quer entender melhor suas opções antes de escolher um plano de saúde.</p>
          <span className="footer-label">Siga a gente</span>
          <div className="social-links">{socials.filter((social) => social.href).map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={17} aria-hidden="true" /></a>)}</div>
        </div>
        <FooterColumn title="Navegação">{navigation.map(([label, href]) => <a key={label} href={`/${href}`}>{label}</a>)}</FooterColumn>
        <FooterColumn title="Contato"><span>WhatsApp<br /><strong>{maskPhone(whatsapp)}</strong></span><span>E-mail<br /><strong>{email}</strong></span><span>Atendimento<br /><strong>{businessHours}</strong></span></FooterColumn>
        <FooterColumn title="Legal"><Link href="/privacidade">Política de Privacidade</Link><Link href="/cookies">Política de Cookies</Link><button type="button" onClick={() => window.dispatchEvent(new Event('open-cookie-preferences'))}>Preferências de Cookies</button><Link href="/termos">Termos de Uso</Link></FooterColumn>
      </div>
      <div className="footer-bottom"><span>© 2026 {brandName}. Todos os direitos reservados.</span><span>{legalName}{cnpj ? ` · CNPJ ${maskCnpj(cnpj)}` : ""}</span><span>Made with ♥ by Willock's House</span></div>
    </div>
  </footer>
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="footer-column"><h2>{title}</h2>{children}</div>
}

export default SiteFooter
