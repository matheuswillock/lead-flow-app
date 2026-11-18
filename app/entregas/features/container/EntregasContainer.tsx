"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { GlowHoverCard } from "@/components/smoothui/glow-hover-card"
import { EntregasProvider } from "../context/EntregasContext"
import { useEntregas } from "../context/EntregasHook"
import type { Periodo } from "../context/EntregasTypes"
import { entregasProjectionService } from "../services/EntregasProjectionService"

const WHATSAPP_URL =
  "https://wa.me/5511939534668?text=Quero%20fechar%20a%20proposta%20de%20assessoria%20comercial%20do%20Corretor%20Studio"

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "trimestre", rotulo: "Trimestre" },
]

const ETAPAS: { titulo: string; texto: string; escura?: boolean; icone: ReactNode }[] = [
  {
    titulo: "Segmentação de base",
    texto: "O Control Desk define o público e prepara a base fria com critérios para chegar no decisor.",
    icone: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />,
  },
  {
    titulo: "Listagens",
    texto: "Listas montadas, qualificadas e enriquecidas antes de qualquer ligação.",
    icone: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </>
    ),
  },
  {
    titulo: "Discadora automática",
    texto: "Operação de discagem em volume, com gestão de campanhas e qualificação de cada contato.",
    icone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    ),
  },
  {
    titulo: "SDR agenda",
    texto: "O SDR qualifica, vende a reunião e entrega o diagnóstico na sua agenda. Você entra e fecha.",
    escura: true,
    icone: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M9 15l2 2 4-4" />
      </>
    ),
  },
]

const NIVEIS: { titulo: string; conv: string; fator: number; escuro?: boolean }[] = [
  { titulo: "Iniciante", conv: "20%", fator: 0.2 },
  { titulo: "Intermediário", conv: "50%", fator: 0.5 },
  { titulo: "Experiente na metodologia", conv: "65%", fator: 0.65, escuro: true },
]

const PREFERS_REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

/** Número que sobe uma vez ao entrar na tela. Sem JS, mostra o valor final. */
function Contador({ para }: { para: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [valor, setValor] = useState(para)

  useEffect(() => {
    if (window.matchMedia(PREFERS_REDUCED_MOTION).matches) return
    const el = ref.current
    if (!el) return
    let frame = 0
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return
        observer.disconnect()
        setValor(0)
        const inicio = performance.now()
        const passo = (agora: number) => {
          const p = Math.min((agora - inicio) / 1200, 1)
          setValor(Math.round(para * (1 - Math.pow(1 - p, 3))))
          if (p < 1) frame = requestAnimationFrame(passo)
        }
        frame = requestAnimationFrame(passo)
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [para])

  return <span ref={ref}>{valor}</span>
}

/** Mesma animação de entrada do HTML original: cada bloco .rev aparece uma vez ao entrar na tela. */
function useRevelarAoRolar(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const raiz = ref.current
    if (!raiz) return
    const elementos = raiz.querySelectorAll<HTMLElement>(".rev")
    if (window.matchMedia(PREFERS_REDUCED_MOTION).matches) {
      elementos.forEach((el) => el.classList.add("on"))
      return
    }
    const observer = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("on")
            observer.unobserve(entrada.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    raiz.classList.add("reveal-ready")
    elementos.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ref])
}

export function EntregasContainer() {
  return (
    <EntregasProvider service={entregasProjectionService}>
      <EntregasView />
    </EntregasProvider>
  )
}

function EntregasView() {
  const raizRef = useRef<HTMLDivElement>(null)
  useRevelarAoRolar(raizRef)

  const { periodo, setPeriodo, projecao } = useEntregas()
  const agendadas = projecao.agendadas
  const realizadas = projecao.realizadas

  return (
    <div className="entregas landing-page" ref={raizRef}>
      <header className="site-header">
        <div className="wrap site-header-inner">
          <Link className="logo" href="/" aria-label="Corretor Studio">
            <img src="/corretor-studio-icon.svg" alt="" width={36} height={36} />
            <span>
              <b>Corretor</b> <i>Studio</i>
            </span>
          </Link>
          <div className="tag-header">Proposta de assessoria comercial</div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="rev">
              <span className="sobre">Assessoria comercial para corretores de plano de saúde</span>
              <h1>
                Você fecha. <strong>A prospecção inteira fica com a gente.</strong>
              </h1>
              <p className="lead">
                Nosso Control Desk e o nosso time de SDR assumem da segmentação da base até a reunião agendada na sua agenda.{" "}
                <span className="destaque">Em média, 3 reuniões por dia.</span>
              </p>
              <div className="acoes">
                <a className="btn btn-primario" href="#investimento">
                  Ver investimento
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="card-proposta rev">
              <div className="topo">
                <span className="pilula">Contrato trimestral</span>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6900" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="3" width="16" height="18" rx="3" />
                  <path d="M8 8h8M8 12h8M8 16h5" />
                </svg>
              </div>
              <div className="linha-item">
                <span className="rotulo">Agendamentos por dia</span>
                <span className="valor">
                  <b>3</b>
                </span>
              </div>
              <div className="linha-item">
                <span className="rotulo">Agendamentos por semana</span>
                <span className="valor">
                  <b>15</b>
                </span>
              </div>
              <div className="linha-item">
                <span className="rotulo">Black Box</span>
                <span className="valor">bônus</span>
              </div>
              <div className="total">
                <span className="rotulo">Investimento mensal</span>
                <span className="valor">
                  <b>R$ 3.500</b>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* como funciona */}
        <section className="bg-branco">
          <div className="wrap">
            <div className="cabecalho rev">
              <h2>
                Do dado frio até a <strong>reunião na sua agenda</strong>
              </h2>
            </div>
            <div className="etapas">
              {ETAPAS.map((etapa, indice) => (
                <div key={etapa.titulo} className={`etapa rev${etapa.escura ? " escura" : ""}`}>
                  <div className="num">{String(indice + 1).padStart(2, "0")}</div>
                  <div className="icone">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {etapa.icone}
                    </svg>
                  </div>
                  <h3>{etapa.titulo}</h3>
                  <p>{etapa.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* capacidade */}
        <section className="bg-pessego">
          <div className="wrap">
            <div className="cabecalho rev">
              <h2>
                Números da nossa <strong>operação real</strong>
              </h2>
            </div>
            <div className="numeros">
              <div className="metric rev">
                <div className="n">
                  <Contador para={3} />
                </div>
                <div className="d">reuniões agendadas por dia, em média</div>
              </div>
              <div className="metric rev">
                <div className="n">
                  <Contador para={15} />
                </div>
                <div className="d">agendamentos por semana</div>
              </div>
              <div className="metric rev">
                <div className="n">
                  <Contador para={60} />
                </div>
                <div className="d">agendamentos por mês</div>
              </div>
              <div className="metric laranja rev">
                <div className="n">
                  <Contador para={25} />
                  <small>%</small>
                </div>
                <div className="d">de no-show médio</div>
              </div>
            </div>
          </div>
        </section>

        {/* régua */}
        <section className="bg-branco" id="regua">
          <div className="wrap">
            <div className="regua-topo">
              <div className="cabecalho rev">
                <h2>
                  Quanto você vende <strong>depende do seu nível</strong>
                </h2>
              </div>
              <div className="seletor rev" role="tablist" aria-label="Período da projeção">
                {PERIODOS.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    role="tab"
                    aria-selected={periodo === item.valor}
                    className={periodo === item.valor ? "ativo" : undefined}
                    onClick={() => setPeriodo(item.valor)}
                  >
                    {item.rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="funil rev">
              <div className="funil-item">
                <span className="rotulo">Reuniões agendadas</span>
                <span className="valor">
                  <b>{agendadas}</b>
                </span>
              </div>
              <div className="funil-item">
                <span className="rotulo">Reuniões realizadas</span>
                <span className="valor">
                  <b>{realizadas}</b>
                </span>
              </div>
            </div>

            <div className="trilho-box rev">
              <div className="trilho-legenda">
                <span>0%</span>
                <span>conversão sobre reuniões realizadas</span>
                <span>100%</span>
              </div>
              <div className="trilho">
                <div className="trilho-fill" />
                <div className="marco" style={{ left: "20%" }} />
                <div className="marco" style={{ left: "50%" }} />
                <div className="marco" style={{ left: "65%" }} />
              </div>

              <div className="niveis">
                {NIVEIS.map((tier) => (
                  <div key={tier.titulo} className={`tier${tier.escuro ? " escuro" : ""}`}>
                    <div className="topo-tier">
                      <h3>{tier.titulo}</h3>
                      <span className="conv">{tier.conv}</span>
                    </div>
                    <div className="vendas">{Math.round(realizadas * tier.fator)}</div>
                    <div className="vendas-d">vendas no período</div>
                  </div>
                ))}
              </div>
              <p className="nota">
                Projeção com 3 agendamentos por dia útil (20 dias úteis no mês), 25% de no-show e conversão média de cada nível sobre
                as reuniões realizadas. Valores arredondados.
              </p>
            </div>
          </div>
        </section>

        {/* bônus */}
        <section>
          <div className="wrap">
            <div className="bonus rev">
              <div>
                <span className="pilula">Bônus gratuito</span>
                <br />
                <h2>
                  Todo o nosso acervo <strong>liberado para você</strong>
                </h2>
                <p>
                  Junto com a assessoria, você recebe acesso completo à Black Box: o acervo de gravações e treinamentos da nossa
                  operação.
                </p>
              </div>
              <div className="caixa-preta">
                <ul>
                  {["Acervo completo de gravações", "Treinamentos da operação", "Acesso durante todo o contrato"].map((texto) => (
                    <li key={texto}>
                      <span className="check">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      </span>
                      {texto}
                    </li>
                  ))}
                </ul>
                <div className="gratis">
                  <span>Investimento</span>
                  <b>R$ 0</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* investimento */}
        <section className="bg-pessego" id="investimento">
          <div className="wrap">
            <div className="cabecalho rev">
              <h2>
                Contrato trimestral, <strong>duas formas de pagar</strong>
              </h2>
            </div>
            <div className="invest-grid">
              <div className="composicao rev">
                <h3>Composição mensal</h3>
                <div className="comp-linha">
                  <span>Prestação de serviço</span>
                  <b>R$ 2.500</b>
                </div>
                <div className="comp-linha">
                  <span>SDR dedicado à sua operação</span>
                  <b>R$ 1.000</b>
                </div>
                <div className="comp-linha">
                  <span>Black Box</span>
                  <b>bônus</b>
                </div>
                <div className="comp-linha soma">
                  <span>Total por mês</span>
                  <b>R$ 3.500</b>
                </div>
              </div>

              <GlowHoverCard className="option rev">
                <div className="topo-op">
                  <h3>Mensal</h3>
                </div>
                <div className="preco">
                  R$ 3.500<small> /mês</small>
                </div>
                <div className="sub">3 parcelas mensais. Total do contrato: R$ 10.500.</div>
              </GlowHoverCard>

              <GlowHoverCard className="option destaque-op rev" glowColor="0 0% 100%">
                <div className="topo-op">
                  <h3>À vista</h3>
                  <span className="pilula">15% off</span>
                </div>
                <div className="preco">R$ 8.925</div>
                <div className="sub">
                  <span className="riscado">R$ 10.500</span> · economia de R$ 1.575 no valor total do contrato.
                </div>
              </GlowHoverCard>
            </div>
          </div>
        </section>

        {/* cta */}
        <section>
          <div className="wrap">
            <div className="cta rev">
              <h2>
                Sua agenda começa a encher <strong>no primeiro trimestre</strong>
              </h2>
              <p>Você foca no que move o resultado: entrar na reunião e fechar.</p>
              <a className="btn btn-branco" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Quero fechar a proposta
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
