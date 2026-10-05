'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Check, ChevronDown, CircleCheck, ClipboardCheck, FileSearch, RotateCcw, RotateCw, ShieldCheck } from 'lucide-react'
import SiteFooter from './site-footer'
import { CookieConsent } from './cookie-consent'

const situations = [
  ['Meu plano ficou caro', 'O reajuste chegou e comecei a questionar se ainda faz sentido continuar no mesmo contrato.'],
  ['Quero contratar um plano', 'Estou pesquisando, mas é difícil entender o que realmente muda entre tantas opções.'],
  ['Quero trocar de plano', 'Preço, rede ou minha realidade mudaram.'],
  ['Tenho CNPJ', 'Quero entender possibilidades para mim, minha família, sócios ou colaboradores.'],
]
const faqs = [
  ['Já tenho plano. Posso fazer uma análise?', 'Sim. Seu cenário atual pode servir como ponto de partida para entender possíveis alternativas.'],
  ['Preciso trocar de plano?', 'Não. O objetivo é entender se uma mudança realmente faz sentido antes de decidir.'],
  ['Preciso ter CNPJ?', 'Depende da modalidade analisada. Existem possibilidades diferentes conforme o perfil.'],
  ['Posso manter meus hospitais e laboratórios?', 'A rede deve fazer parte da comparação. As possibilidades dependem dos produtos disponíveis para o perfil e a região.'],
  ['Como funciona carência?', 'As condições variam conforme produto, operadora e situação. O especialista poderá explicar o cenário aplicável.'],
]

function Button({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <a href="#analise" className={`button ${light ? "button-light" : ""}`}>{children}<ArrowRight size={17} aria-hidden="true" /></a>
}

function Brand({ name }: { name: string }) {
  return <a href="#top" className="brand" aria-label="Voltar ao início">{name}</a>
}

export default function AnalysisLanding({ brandName, renderForm }: { brandName: string; renderForm: (compact: boolean) => ReactNode }) {
  const [openFaq, setOpenFaq] = useState(0)
  const [heroFlipped, setHeroFlipped] = useState(false)
  const heroCardRef = useRef<HTMLDivElement>(null)
  const heroBackRef = useRef<HTMLButtonElement>(null)
  const lastHeroTriggerRef = useRef<HTMLButtonElement | null>(null)

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const openHeroForm = (trigger: HTMLButtonElement) => {
    lastHeroTriggerRef.current = trigger
    setHeroFlipped(true)
  }
  const closeHeroForm = () => {
    const trigger = lastHeroTriggerRef.current
    setHeroFlipped(false)
    window.setTimeout(() => trigger?.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 340)
  }

  useEffect(() => {
    if (!heroFlipped) return
    const card = heroCardRef.current
    const reduceMotion = prefersReducedMotion()
    let cardNeedsScroll = false
    if (card) {
      const rect = card.getBoundingClientRect()
      const isVisible = rect.top >= 80 && rect.bottom <= window.innerHeight
      cardNeedsScroll = !isVisible
      if (cardNeedsScroll) card.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
    return undefined
  }, [heroFlipped])


  return <div className="bw-source">
    <header className="site-header"><div className="container header-inner"><Brand name={brandName} /><nav aria-label="Navegação principal"><a href="#processo">Como funciona</a><a href="#analise" className="header-cta">Analisar opções <ArrowRight size={15} aria-hidden="true" /></a></nav></div></header>
    <main id="top">
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Antes de escolher, compare com contexto</p>
            <h1>Antes de trocar ou contratar um plano, entenda o que <em>realmente vale a pena comparar.</em></h1>
            <p className="hero-lede">Preço importa. Mas rede hospitalar, coparticipação, região, reajustes e perfil das vidas também podem mudar completamente a escolha.</p>
            <p className="hero-support">Uma análise ajuda você a entender essas diferenças antes de decidir.</p>
            <div className="hero-actions">
              <button type="button" className="button" aria-expanded={heroFlipped} aria-controls="hero-scenario-form" onClick={event => openHeroForm(event.currentTarget)}>Quero analisar minhas opções <ArrowRight size={17} aria-hidden="true" /></button>
              <a className="text-link" href="#processo">Ver como funciona <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <p className="microcopy"><ShieldCheck size={15} aria-hidden="true" /> Análise personalizada <span>•</span> Atendimento humano <span>•</span> Sem compromisso</p>
          </div>
          <div ref={heroCardRef} className={`scenario-flip-shell ${heroFlipped ? 'is-flipped' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && heroFlipped) closeHeroForm() }}>
            <div className="scenario-flip-inner">
              <div className="analysis-window scenario-face scenario-front" aria-label="Exemplo visual de uma análise" aria-hidden={heroFlipped} inert={heroFlipped}>
                <div className="window-top"><span className="window-label"><span className="pulse" /> cenário atual</span><span className="window-dots" aria-hidden="true">•••</span></div>
                <div className="scenario"><div><p className="mini-label">Seu cenário</p><h2>Situação atual</h2></div><span className="scenario-tag">Em análise</span></div>
                <div className="stats"><div><span>Plano atual</span><strong>Bradesco Saúde Nacional</strong></div><div><span>Pessoas</span><strong>4 vidas</strong></div><div><span>Mensalidade atual</span><strong>R$ 2.480 <small>/ mês</small></strong></div><div><span>Último reajuste</span><strong>+17,8%</strong></div></div>
                <div className="objective"><span>Objetivo</span><strong>Reduzir o custo preservando hospitais importantes.</strong></div>
                <div className="window-divider" />
                <p className="mini-label">Pontos analisados</p>
                <div className="check-list">{['Rede hospitalar', 'Região', 'Coparticipação', 'Perfil das vidas', 'Condições do plano', 'Alternativas'].map(x => <span key={x}><Check size={14} aria-hidden="true" />{x}</span>)}</div>
                <button type="button" className="ready scenario-flip-trigger" aria-expanded={heroFlipped} aria-controls="hero-scenario-form" onClick={event => openHeroForm(event.currentTarget)}><RotateCw size={17} aria-hidden="true" /><span><strong>Preencher meu cenário</strong><small>Leva poucos minutos</small></span></button>
              </div>
              <div id="hero-scenario-form" className="analysis-window scenario-face scenario-back hero-form-face" aria-hidden={!heroFlipped} inert={!heroFlipped}>
                <div className="hero-form-top"><span className="window-label"><RotateCw size={14} aria-hidden="true" /> seu cenário</span><button ref={heroBackRef} type="button" className="hero-back-button" onClick={closeHeroForm}>Voltar ao cenário atual <RotateCcw size={14} aria-hidden="true" /></button></div>
                {renderForm(true)}
              </div>
            </div>
            <span className="sr-only" aria-live="polite">{heroFlipped ? 'Formulário de análise aberto no card.' : 'Cenário atual exibido no card.'}</span>
          </div>
        </div>
      </section>

      <section className="section situations"><div className="container"><div className="section-heading"><div><p className="eyebrow">O que trouxe você até aqui?</p><h2>Qual dessas situações parece mais com a sua?</h2></div><p className="section-lede">Cada cenário pede uma análise diferente.</p></div><div className="situation-grid">{situations.map(([title, text]) => <article className="situation-card" key={title}><h3>{title}</h3><p>{text}</p><a href="#analise">Entender meu cenário <ArrowRight size={15} aria-hidden="true" /></a></article>)}</div><div className="section-action"><Button>Quero entender meu cenário</Button></div></div></section>

      <section className="section awareness">
        <div className="container awareness-layout">
          <div className="price-card">
            <p className="mini-label">O primeiro olhar</p>
            <span className="price-label">Mensalidade</span>
            <h3>Quanto custa por mês?</h3>
            <p>É natural começar pelo preço. Antes de decidir, veja também a rede, as regras de uso e quem será atendido.</p>
          </div>
          <div className="context-content">
            <p className="eyebrow">O que também entra na decisão?</p>
            <h2>O preço chama atenção primeiro. <em>Depois, veja o que o plano entrega.</em></h2>
            <p className="section-lede">Uma mensalidade menor pode parecer a melhor escolha. Mas rede, coparticipação, abrangência e condições de uso mudam o que você recebe e quanto pode pagar ao usar o plano.</p>
            <div className="context-heading">
              <h3>Compare o valor dentro do seu cenário.</h3>
              <p>Estes pontos ajudam a entender se o plano atende o que você precisa hoje e como o custo pode mudar com o uso.</p>
            </div>
            <div className="factor-grid">
              {[
                ['Rede e laboratórios', 'Quais hospitais, clínicas e laboratórios fazem parte da rede.'],
                ['Coparticipação e utilização', 'Quanto você pode pagar além da mensalidade ao usar o plano.'],
                ['Abrangência e região', 'Em quais cidades e regiões você terá atendimento.'],
                ['Acomodação', 'Qual tipo de quarto está previsto em uma internação.'],
                ['Perfil das vidas', 'Idades, dependentes e composição do grupo.'],
                ['Reajustes e condições', 'Como o valor e as regras podem mudar ao longo do contrato.'],
              ].map(([title, text]) => <div className="factor-item" key={title}><div><h4>{title}</h4><p>{text}</p></div></div>)}
            </div>
          </div>
        </div>
        <div className="container quote-compare">
          <div className="quote-card muted-card">
            <div className="compare-title"><FileSearch size={18} aria-hidden="true" /> Cotação <span>valores ilustrativos</span></div>
            {[['Plano A', 'R$ 1.890/mês'], ['Plano B', 'R$ 2.140/mês'], ['Plano C', 'R$ 2.390/mês']].map(([name, price]) => <div className="quote-row" key={name}><span>{name}</span><b>{price}</b></div>)}
            <p className="compare-note">Mostra quanto cada opção custa.<br />Valores ilustrativos.</p>
          </div>
          <div className="quote-card analysis-card">
            <div className="compare-title"><ClipboardCheck size={18} aria-hidden="true" /> Análise <span>com contexto</span></div>
            <div className="context-list">{['Seu orçamento', 'Sua região', 'Sua rede', 'Quem utilizará', 'Situação atual', 'Objetivo'].map(x => <span key={x}><Check size={14} aria-hidden="true" />{x}</span>)}</div>
            <p className="compare-note">Mostra contexto para decidir.</p>
          </div>
        </div>
        <p className="closing-line">Primeiro entendemos o cenário. <strong>Depois comparamos.</strong></p>
      </section>

      <section id="processo" className="section process"><div className="container"><div className="center"><p className="eyebrow">Como funciona</p><h2>Primeiro entendemos.<br /><em>Depois mostramos as possibilidades.</em></h2></div><div className="steps">{[['01', 'Conte seu cenário', 'Envie algumas informações para contextualizar o que você procura.'], ['02', 'Um especialista analisa', 'Entendemos perfil, região, prioridades e objetivo.'], ['03', 'Compare com clareza', 'Converse sobre as possibilidades e entenda as diferenças antes de decidir.']].map(([n, t, d]) => <article className="step" key={n}><span className="step-number">{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div><div className="process-cta"><span><CircleCheck size={18} aria-hidden="true" /> Sem compromisso.</span><Button>Quero analisar minhas opções</Button></div></div></section>

      <section className="section trust"><div className="container trust-inner"><p className="eyebrow">Confiança</p><h2>Entender suas opções não obriga você a mudar de plano.</h2><div className="trust-grid">{[['Sem pressão', 'A análise existe para ajudar você a entender o cenário.'], ['Com contexto', 'Você conhece diferenças relevantes antes de considerar qualquer mudança.'], ['A decisão continua sendo sua', 'Depois de entender as alternativas, você escolhe o que faz sentido.']].map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div></div></section>

      <section id="analise" className="form-section"><div className="container form-grid"><div className="form-intro"><p className="eyebrow">Análise personalizada</p><h2>Conte um pouco sobre o seu cenário.</h2><p>Essas informações ajudam o especialista a chegar à conversa com mais contexto.</p><div className="next-steps">{['Você envia as informações.', 'Seu cenário é analisado.', 'Vocês conversam sobre as possibilidades.'].map((x, i) => <div key={x}><span>0{i + 1}</span><p>{x}</p></div>)}</div></div><div className="form-card">{renderForm(false)}</div></div></section>

      <section className="section faq"><div className="container faq-grid"><div><p className="eyebrow">Ainda ficou com uma dúvida?</p><h2>Antes de fazer sua análise...</h2><p className="section-lede">A primeira conversa existe para esclarecer, não para pressionar.</p></div><div className="faq-list">{faqs.map(([q, a], i) => { const id = `faq-answer-${i}`; return <div className={`faq-item ${openFaq === i ? 'open' : ''}`} key={q}><button type="button" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i} aria-controls={id}><span>{q}</span><ChevronDown size={18} aria-hidden="true" /></button><div id={id} role="region" hidden={openFaq !== i}><p>{a}</p></div></div> })}</div></div></section>
      <section className="final-cta"><div className="container center"><p className="eyebrow">Antes de decidir</p><h2>Entenda suas opções antes de escolher.</h2><p>Uma análise pode ajudar você a comparar o cenário com mais clareza.</p><Button light>Quero analisar minhas opções</Button></div></section>
    </main>
    <SiteFooter />
    <CookieConsent />
  </div>
}
