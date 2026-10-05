'use client'

import Link from 'next/link'
const navigation = [['Como funciona', '#processo'], ['Analisar opções', '#analise'], ['Dúvidas frequentes', '#duvidas'], ['Contato', '#analise']]
const socials: { label: string; href: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: string }> }[] = []

export function SiteFooter() {
  return <footer className="institutional-footer">
    <div className="container">
      <div className="footer-columns">
        <div className="footer-brand-column">
          <Link href="/#top" className="brand footer-brand" aria-label="Sua marca — início">Sua marca</Link>
          <p>Consultoria para quem quer entender melhor suas opções antes de escolher um plano de saúde.</p>
          <span className="footer-label">Siga a gente</span>
          <div className="social-links">{socials.filter((social) => social.href).map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={17} aria-hidden="true" /></a>)}</div>
        </div>
        <FooterColumn title="Navegação">{navigation.map(([label, href]) => <a key={label} href={`/${href}`}>{label}</a>)}</FooterColumn>
        <FooterColumn title="Contato"><span>WhatsApp<br /><strong>[WHATSAPP]</strong></span><span>E-mail<br /><strong>[EMAIL DE CONTATO]</strong></span><span>Atendimento<br /><strong>[HORÁRIO]</strong></span></FooterColumn>
        <FooterColumn title="Legal"><Link href="/privacidade">Política de Privacidade</Link><Link href="/cookies">Política de Cookies</Link><button type="button" onClick={() => window.dispatchEvent(new Event('open-cookie-preferences'))}>Preferências de Cookies</button><span className="footer-placeholder-link">Termos de Uso</span></FooterColumn>
      </div>
      <div className="footer-bottom"><span>© 2026 Sua marca. Todos os direitos reservados.</span><span>[RAZÃO SOCIAL] · CNPJ [XX.XXX.XXX/0001-XX]</span></div>
    </div>
  </footer>
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="footer-column"><h2>{title}</h2>{children}</div>
}

export default SiteFooter
