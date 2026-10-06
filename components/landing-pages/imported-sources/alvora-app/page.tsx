'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from "next/link"
import { CookieConsent } from "../black-and-white-components/cookie-consent"
import Image, { getImageProps } from 'next/image'
import { ArrowRight, BriefcaseBusiness, Building2, Check, ChevronDown, Clock3, Heart, HeartHandshake, HeartPulse, Medal, Menu, MessageCircle, PhoneCall, ShieldCheck, Smile, Stethoscope, UserRoundPlus, Users, UsersRound, X } from 'lucide-react'

const operators = [
  { name: 'SulAmérica', src: '/landing-templates/alvora/assets/operators/sulamerica.webp', width: 338, height: 150 },
  { name: 'Unimed', src: '/landing-templates/alvora/assets/operators/unimed.svg', width: 1070, height: 309 },
  { name: 'Hapvida', src: '/landing-templates/alvora/assets/operators/hapvida.png', width: 261, height: 58 },
  { name: 'NotreDame Intermédica', src: '/landing-templates/alvora/assets/operators/notredame.png', width: 210, height: 210 },
  { name: 'Bradesco Saúde', src: '/landing-templates/alvora/assets/operators/bradesco.svg', width: 123, height: 23 },
  { name: 'Amil', src: '/landing-templates/alvora/assets/operators/amil.svg', width: 4094, height: 1458 },
  { name: 'Porto Seguro', src: '/landing-templates/alvora/assets/operators/porto.svg', width: 138, height: 32 },
  { name: 'Omint', src: '/landing-templates/alvora/assets/operators/omint.svg', width: 200, height: 60 },
  { name: 'Sami', src: '/landing-templates/alvora/assets/operators/sami.svg', width: 104, height: 37 },
  { name: 'MedSênior', src: '/landing-templates/alvora/assets/operators/medsenior.webp', width: 800, height: 277 },
  { name: 'Prevent Senior', src: '/landing-templates/alvora/assets/operators/preventsenior.png', width: 109, height: 62 },
  { name: 'Allianz Saúde', src: '/landing-templates/alvora/assets/operators/allianz.svg', width: 400, height: 99 },
  { name: 'Golden Cross', src: '/landing-templates/alvora/assets/operators/goldencross.webp', width: 1146, height: 424 },
  { name: 'Care Plus', src: '/landing-templates/alvora/assets/operators/careplus.svg', width: 220, height: 60 },
  { name: 'Trasmontano', src: '/landing-templates/alvora/assets/operators/trasmontano.png', width: 400, height: 105 },
]
const faqs = [
  ['Posso contratar um plano de saúde pelo meu CNPJ?', 'Empresários com CNPJ ativo podem ter acesso a planos coletivos empresariais, desde que atendam às condições de contratação. Nossa equipe analisa a documentação e verifica as opções disponíveis para o seu perfil.'],
  ['Sou MEI. Posso contratar para mim e minha família?', 'É possível contratar determinados planos empresariais como MEI e incluir familiares elegíveis, conforme as regras do contrato. Também é necessário comprovar a atividade empresarial pelo período mínimo exigido e atender às condições da operadora.'],
  ['Qual é a quantidade mínima de pessoas para contratar?', 'A quantidade mínima depende do plano e da operadora. Existem ofertas a partir de duas vidas. Avaliamos as condições disponíveis para você.'],
  ['Quanto custa um plano de saúde?', 'O preço depende de fatores como idade, região, tipo de contratação, cobertura e quantidade de beneficiários. Realizamos uma cotação para comparar as alternativas.'],
  ['Posso trocar de plano sem cumprir todas as carências novamente?', 'Dependendo do seu contrato atual e dos requisitos aplicáveis, pode ser possível aproveitar carências por meio da portabilidade ou de outras condições de contratação.'],
  ['O atendimento da corretora é gratuito?', 'A consultoria para comparar as opções e receber orientação na contratação é gratuita, conforme a proposta comercial apresentada.'],
]

function HeroPicture() {
  const common = {
    alt: 'Família reunida em um momento de carinho',
    sizes: '100vw',
    quality: 80,
    loading: 'eager' as const,
    decoding: 'async' as const,
    fetchPriority: 'high' as const,
  }
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: '/landing-templates/alvora/assets/hero/hero-family-centered-v2.png',
    width: 1672,
    height: 941,
  })
  const {
    props: { srcSet: mobileSrcSet, ...mobileImageProps },
  } = getImageProps({
    ...common,
    src: '/landing-templates/alvora/assets/hero/hero-family-mobile-v1.png',
    width: 1080,
    height: 1920,
  })

  return <picture>
    <source media="(min-width: 781px)" srcSet={desktopSrcSet} sizes="(max-width: 1672px) 100vw, 1672px" />
    <source media="(max-width: 780px)" srcSet={mobileSrcSet} sizes="100vw" />
    <img {...mobileImageProps} alt={common.alt} />
  </picture>
}

function OperatorGroup({ hidden = false }: { hidden?: boolean }) {
  return <div className="operator-group" aria-hidden={hidden}>
    {operators.map(({ name, src, width, height }) => src.endsWith('.svg')
      ? <img key={name} src={src} width={width} height={height} loading="lazy" decoding="async" alt={hidden ? '' : `Logo ${name} — operadora parceira`} />
      : <Image key={name} src={src} width={width} height={height} sizes="132px" loading="lazy" decoding="async" alt={hidden ? '' : `Logo ${name} — operadora parceira`} />)}
  </div>
}

function PersonHealthSection() {
  return <section className="split-section person-health" id="pessoa-fisica">
    <div className="person-health__image"><Image src="/landing-templates/alvora/assets/sections/person-44-fitness.png" alt="Homem maduro correndo em um parque urbano" fill sizes="(max-width: 780px) calc(100vw - 44px), (max-width: 1180px) 42vw, 520px" quality={80} loading="lazy" decoding="async" style={{ objectFit: 'cover' }} /></div>
    <div className="person-health__content">
      <h2>A partir dos 44 anos,<br /><span className="section-title-accent">escolher bem faz a diferença.</span></h2>
      <p>A cada nova faixa etária, os valores podem mudar. Comparamos rede credenciada, carências e reajustes entre as operadoras, incluindo planos por adesão e opções para o público sênior.</p>
      <div className="button-row"><a className="button button-primary" href="#contato">Comparar opções para mim <ArrowRight size={16} /></a><a className="button button-secondary" href="#contato"><MessageCircle size={16} /> Fale com a gente</a></div>
    </div>
  </section>
}

function BusinessHealthSection() {
  return <section className="split-section business-health" id="empresarial">
    <div className="business-health__image"><Image src="/landing-templates/alvora/assets/sections/business-family-cnpj.png" alt="Empresário reunido com a família em casa" fill sizes="(max-width: 780px) calc(100vw - 44px), (max-width: 1180px) 42vw, 520px" quality={80} loading="lazy" decoding="async" style={{ objectFit: 'cover' }} /></div>
    <div className="business-health__content">
      <h2>Plano de Saúde para<br /><span className="section-title-accent">Pequenas e Médias<br />Empresas</span></h2>
      <p>Para você que tem CNPJ, é empreendedor ou empreendedora e pretende contratar um plano para 2 a 199 pessoas, oferecemos diversas opções de convênios médicos que combinam com o seu negócio.</p>
      <div className="button-row"><a className="button button-primary" href="#contato">Peça uma cotação</a><a className="button button-secondary" href="#contato"><MessageCircle size={16} /> Fale com a gente</a></div>
    </div>
  </section>
}

export default function Page({ brandName, phoneDisplay, phoneE164, whatsappUrl, renderForm }: { brandName: string; phoneDisplay?: string; phoneE164?: string; whatsappUrl: string; renderForm: () => ReactNode }) {
  const displayPhone = (value?: string) => { const digits = value?.replace(/\D/g, "") ?? ""; return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : value ?? "Atendimento" }
  const maskedPhone = displayPhone(phoneDisplay)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const currentYear = new Date().getFullYear()
  const nav = [['Pessoa Física', '#pessoa-fisica'], ['PME & Empresarial', '#empresarial'], ['Como Funciona', '#como-funciona'], ['Diferenciais', '#diferenciais'], ['FAQ', '#faq']]
  return <div className="site-shell alvora-source">
    <header className="site-header">
      <div className="header-top"><a className="brand" href="#top"><span>corretora</span><b>{brandName}</b></a><div className="header-actions"><a className="header-phone" href={phoneE164 ? `tel:${phoneE164}` : "#contato"}>{maskedPhone}</a><a className="header-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a><a className="header-simulate" href="#contato">Simule agora</a></div><button className="menu-button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      <nav className={menuOpen ? 'nav mobile-open' : 'nav'}>{nav.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<a href="#contato" onClick={() => setMenuOpen(false)}>Fale conosco</a></nav>
    </header>
    <main id="top">
      <section className="hero"><div className="hero-photo"><HeroPicture /></div><div className="hero-inner"><div className="hero-copy"><p className="hero-pretitle">Compare planos de saúde</p><p className="hero-pretitle hero-health">para você e sua família.</p><h1>para você<br /><span>e sua família.</span></h1><p className="hero-description">Descubra opções pelo seu CNPJ, além de alternativas individuais e por adesão. Nossa equipe ajuda você a comparar valores, coberturas e operadoras.</p><div className="hero-actions"><div><small>ATENDIMENTO</small><a href={phoneE164 ? `tel:${phoneE164}` : "#contato"}>{maskedPhone}</a></div><a className="whatsapp-link" href="#contato"><MessageCircle size={18} /> Quero comparar os planos</a></div></div><div className="hero-form"><div className="form-heading"><span>01</span><div><h2>Precisa de ajuda para escolher?</h2><p>Nossos especialistas entram em contato com você.</p></div></div>{renderForm()}</div></div></section>
      <section className="operator-strip"><p>PRINCIPAIS OPERADORAS PARCEIRAS DE PLANO DE SAÚDE</p><div className="operators-viewport"><div className="operators-track"><OperatorGroup /><OperatorGroup hidden /></div></div></section>
      <BusinessHealthSection />
      <section className="steps-section" id="como-funciona"><div className="section-intro"><p className="eyebrow">COMO FUNCIONA</p><h2>Seu plano de saúde<br /><em>em quatro passos.</em></h2><p>Simples, rápido e com acompanhamento de um especialista.</p></div><div className="steps">{[['01','Conte seu perfil','Informe se deseja contratar pelo CNPJ ou como pessoa física e quais são suas necessidades.'],['02','Receba as opções','Nossa equipe identifica os planos disponíveis para o seu perfil entre as operadoras parceiras.'],['03','Compare os planos','Avalie preços, rede credenciada, coberturas, carências e condições de contratação.'],['04','Contrate com apoio','Receba orientação durante a contratação e conte com acompanhamento no pós-venda.']].map(([n,t,d], i) => <div className="step" key={n}><span className="step-number">{n}</span><div><h3>{t}</h3><p>{d}</p></div>{i < 3 && <span className="step-line" />}</div>)}</div></section>
      <PersonHealthSection />
      <section className="differentials" id="diferenciais"><div className="differentials-inner"><div className="section-intro"><p className="eyebrow">POR QUE ESCOLHER A SUA CORRETORA</p><h2>Mais que uma corretora,<br />um time ao seu lado.</h2></div><div className="diff-grid">{[[HeartHandshake, 'Consultoria gratuita', 'Orientação sem custo para ajudar você a escolher.'],[Users, 'Opções para empresários', 'Alternativas pelo CNPJ, conforme a sua elegibilidade.'],[Building2, 'Comparação de operadoras', 'Análise de preços, coberturas e rede para o seu perfil.'],[ShieldCheck, 'Acompanhamento no pós-venda', 'Suporte com dúvidas, reajustes e possibilidades de troca.'],[Medal, 'Análise personalizada', 'Sua idade, sua família e suas prioridades entram na comparação.'],[Smile, 'Atendimento humano', 'Uma equipe preparada para conversar e acompanhar sua decisão.']].map(([Icon, title, description]) => <article className="diff-item" key={title as string}><Icon aria-hidden="true" /><h3>{title as string}</h3><p>{description as string}</p></article>)}</div></div></section>
      <section className="faq" id="faq"><div className="faq-inner"><div className="faq-intro"><p className="eyebrow">DÚVIDAS FREQUENTES</p><h2>Plano de saúde sem complicação</h2></div><div className="faq-list">{faqs.map(([q,a], i) => <div className={openFaq === i ? 'faq-item open' : 'faq-item'} key={q}><button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}><span>{q}</span><ChevronDown aria-hidden="true" /></button>{openFaq === i && <p>{a}</p>}</div>)}</div></div></section>
      <section className="contact-section" id="contato"><div className="contact-inner"><div className="contact-copy"><h2>Descubra qual plano<br />faz sentido <em>para você.</em></h2><p>Conte um pouco sobre seu perfil e nossa equipe ajudará você a comparar as alternativas disponíveis, seja para contratação pelo CNPJ ou como pessoa física.</p><div className="contact-numbers"><a href={phoneE164 ? `tel:${phoneE164}` : "#contato"}><PhoneCall aria-hidden="true" size={17} /> {maskedPhone}</a></div></div><div className="contact-form">{renderForm()}</div></div></section>
    </main>
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-column">
          <h3 className="footer-title">SOBRE A ALVORA</h3>
          <nav className="footer-links" aria-label="Sobre a Alvora">
            <a href="#pessoa-fisica">Nossa atuação</a><a href="#como-funciona">Quem somos</a><a href="#contato">Trabalhe conosco</a>
            <Link href="/privacidade">Política de privacidade</Link><Link href="/cookies">Política de Cookies</Link><button type="button" onClick={() => window.dispatchEvent(new Event("open-cookie-preferences"))}>Preferências de Cookies</button>
          </nav>
        </div>
        <div className="footer-column footer-contact">
          <h3 className="footer-title">CONTATO</h3>
          <div className="footer-contact-item">
            <span className="footer-label">Atendimento</span>
            <a className="footer-phone" href={phoneE164 ? `tel:${phoneE164}` : "#contato"}>{maskedPhone}</a>
          </div>
          <div className="footer-contact-item">
            <span className="footer-label">WhatsApp comercial</span>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">Disponível</a>
          </div>
        </div>
        <div className="footer-column footer-company">
          <h3 className="footer-title">EMPRESA</h3>
          <p>Planos de saúde escolhidos<br />com cuidado para você.</p>
        </div>
      </div>
      <div className="footer-bottom"><span>© {currentYear} {brandName}. Todos os direitos reservados.</span><span className="footer-credit">Made with <Heart aria-hidden="true" size={13} fill="currentColor" /> by <a href="https://willockshouse.com" target="_blank" rel="noreferrer">Willock's House</a></span></div>
    </footer>
    <a className="floating-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"><MessageCircle size={22} /></a>
    <CookieConsent />
  </div>
}
