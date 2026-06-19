"use client"

import { useEffect } from "react"
import { Shield, Check, FileText, RefreshCw, Calendar, Handshake } from "lucide-react"
import { cn } from "@/lib/utils"

const gradStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--prime-o1), var(--prime-o2), var(--prime-o3), var(--prime-o4))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}

const gradGold: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--prime-o4), #FFD180)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}

const gradBg: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--prime-o2), var(--prime-o3))",
}

function GradText({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return <span style={gold ? gradGold : gradStyle}>{children}</span>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-medium tracking-[.1em] uppercase mb-2.5"
      style={{ color: "var(--prime-o2)" }}
    >
      {children}
    </p>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[clamp(18px,4vw,26px)] font-medium leading-[1.2] tracking-[-0.015em] mb-2.5"
      style={{ color: "#181612" }}
    >
      {children}
    </h2>
  )
}

function ItemList({ items }: { items: { title: string; sub: string }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 py-3 border-b border-[#E4E0D8] last:border-0">
          <span
            className="size-[7px] rounded-full flex-shrink-0 mt-[6px]"
            style={{ background: "var(--prime-o2)" }}
          />
          <div>
            <p className="text-[13px] font-medium mb-0.5" style={{ color: "#181612" }}>{item.title}</p>
            <p className="text-[12px] font-light leading-[1.55]" style={{ color: "#52504A" }}>
              {item.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function BbCard({ title, desc, tag }: { title: string; desc: string; tag: string }) {
  return (
    <div
      className="rounded-[14px] p-5 mb-3 border"
      style={{ background: "#fff", borderColor: "#E4E0D8", borderTopWidth: "3px", borderTopColor: "var(--prime-o2)" }}
    >
      <p className="text-[14px] font-medium mb-1.5" style={{ color: "#181612" }}>{title}</p>
      <p className="text-[12px] font-light leading-[1.6]" style={{ color: "#52504A" }}>
        {desc}
      </p>
      <span
        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-[4px] mt-2.5"
        style={{ color: "var(--prime-o2)", background: "color-mix(in srgb, var(--prime-o2) 10%, transparent)" }}
      >
        {tag}
      </span>
    </div>
  )
}

function MeetingRow({
  abbr,
  day,
  title,
  desc,
  bg,
}: {
  abbr: string
  day: string
  title: string
  desc: string
  bg: string
}) {
  return (
    <div
      className="flex items-start gap-3.5 py-3.5 border-b last:border-0"
      style={{ borderColor: "#E4E0D8" }}
    >
      <div
        className="flex flex-col items-center justify-center flex-shrink-0"
        style={{ width: 44, height: 44, borderRadius: 10, background: bg }}
      >
        <span style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", color: "rgba(255,255,255,.8)" }}>
          {abbr}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{day}</span>
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 3, color: "#181612" }}>{title}</p>
        <p style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.55, color: "#52504A" }}>{desc}</p>
      </div>
    </div>
  )
}

function AnexoCard({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-[9px] p-4 mb-2.5 border border-[#E4E0D8] bg-[#fff]">
      <div
        className="size-9 rounded-[9px] flex items-center justify-center flex-shrink-0"
        style={{ background: "color-mix(in srgb, var(--prime-o2) 10%, transparent)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-medium mb-0.5" style={{ color: "#181612" }}>{title}</p>
        <p className="text-[12px] font-light leading-[1.55]" style={{ color: "#52504A" }}>
          {sub}
        </p>
      </div>
    </div>
  )
}

export function PrimePage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("prime-in")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll(".prime-reveal").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const iconColor = { color: "var(--prime-o2)" } as React.CSSProperties

  return (
    <>
      <style>{`
        :root {
          --prime-o1: color-mix(in srgb, var(--primary) 73%, oklch(0.15 0.18 28));
          --prime-o2: color-mix(in srgb, var(--primary) 88%, oklch(0.15 0.15 28));
          --prime-o3: var(--primary);
          --prime-o4: color-mix(in srgb, var(--primary) 58%, white);
          --prime-dark: oklch(0.11 0.04 33);
          --prime-dark2: oklch(0.17 0.055 33);
          --prime-bg: #F6F4F0;
          --prime-bg2: #fff;
          --prime-text: #181612;
          --prime-text2: #52504A;
          --prime-text3: #9A978F;
          --prime-border: #E4E0D8;
        }
        .prime-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1);
        }
        .prime-reveal.prime-in { opacity: 1; transform: none; }
        @keyframes prime-bdot {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--prime-o2) 40%, transparent); }
          50%       { box-shadow: 0 0 0 5px transparent; }
        }
        .prime-bdot { animation: prime-bdot 2s infinite; }
        .prime-btn-cta:hover { filter: brightness(1.08); transform: translateY(-2px); }
        .prime-sdr-card:hover { border-color: color-mix(in srgb, var(--prime-o2) 30%, transparent) !important; }
        .prime-pag-card-destaque::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--prime-o1), var(--prime-o3));
        }
      `}</style>

      <div
        className="overflow-x-hidden"
        style={{ fontFamily: "'Poppins', sans-serif", maxWidth: 680, margin: "0 auto", color: "#181612", background: "#F6F4F0" }}
      >
        {/* HERO */}
        <div
          className="relative overflow-hidden text-center border-b border-[#E4E0D8]"
          style={{ padding: "48px 24px 40px", background: "#fff" }}
        >
          {/* background radial glow */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, var(--prime-o2) 7%, transparent) 0%, transparent 70%)",
            }}
          />
          {/* decorative rings */}
          <div
            aria-hidden
            className="absolute rounded-full pointer-events-none border"
            style={{
              width: 340,
              height: 340,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              borderColor: "color-mix(in srgb, var(--prime-o2) 7%, transparent)",
            }}
          />
          <div
            aria-hidden
            className="absolute rounded-full pointer-events-none border"
            style={{
              width: 540,
              height: 540,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              borderColor: "color-mix(in srgb, var(--prime-o2) 7%, transparent)",
            }}
          />
          {/* decorative squares */}
          {[
            { w: 36, h: 36, top: "14%", left: "6%", rot: "rotate(14deg)" },
            { w: 24, h: 24, top: "22%", right: "8%", rot: "rotate(-10deg)" },
            { w: 48, h: 48, bottom: "18%", left: "4%", rot: "rotate(22deg)" },
          ].map((sq, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute pointer-events-none border rounded-[3px]"
              style={{
                width: sq.w,
                height: sq.h,
                top: sq.top,
                left: sq.left,
                right: (sq as { right?: string }).right,
                bottom: (sq as { bottom?: string }).bottom,
                transform: sq.rot,
                borderColor: "color-mix(in srgb, var(--prime-o2) 8%, transparent)",
              }}
            />
          ))}

          {/* badge */}
          <div
            className="inline-flex items-center gap-[7px] text-[11px] font-medium tracking-[.04em] px-3.5 py-[5px] rounded-full mb-6 relative z-[2] border"
            style={{
              background: "color-mix(in srgb, var(--prime-o2) 8%, #fff)",
              borderColor: "color-mix(in srgb, var(--prime-o2) 20%, transparent)",
              color: "var(--prime-o1)",
            }}
          >
            <span
              className="prime-bdot size-[6px] rounded-full flex-shrink-0"
              style={{ background: "var(--prime-o2)" }}
            />
            Onside Ltda · Backstage Club
          </div>

          <h1
            className="relative z-[2] font-medium leading-[1.15] tracking-[-0.025em] mb-3"
            style={{ fontSize: "clamp(26px,6vw,44px)", color: "#181612" }}
          >
            Proposta <GradText>Prime</GradText>
          </h1>

          <p
            className="text-[14px] font-light leading-[1.7] max-w-[480px] mx-auto mb-7 relative z-[2]"
            style={{ color: "#52504A" }}
          >
            100 dias de imersão total na construção de uma operação comercial previsível, lucrativa e que não
            escraviza o dono.
          </p>

          {/* price box */}
          <div
            className="inline-block rounded-[14px] px-8 py-5 relative z-[2] mb-2 border border-[#E4E0D8]"
            style={{ background: "#F6F4F0" }}
          >
            <p className="text-[11px] font-medium tracking-[.08em] uppercase mb-2" style={{ color: "#9A978F" }}>
              Investimento
            </p>
            <p className="text-[40px] font-medium tracking-[-0.03em] leading-none mb-1" style={gradStyle}>
              R$ 15.000
            </p>
            <p className="text-[12px] my-1.5" style={{ color: "#9A978F" }}>
              ou
            </p>
            <p className="text-[15px] font-medium" style={{ color: "#181612" }}>
              R$ 14.000 <span style={{ color: "var(--prime-o2)" }}>no Pix</span>
            </p>
            <p className="text-[12px] font-light mt-1" style={{ color: "#9A978F" }}>
              4x de R$ 3.750 no cartão sem juros
            </p>
          </div>

          <p className="text-[12px] font-light relative z-[2]" style={{ color: "#9A978F" }}>
            <strong className="font-medium" style={{ color: "#52504A" }}>100 dias</strong> de acompanhamento contínuo
          </p>
        </div>

        {/* O PROGRAMA */}
        <div className="prime-reveal border-b border-[#E4E0D8] bg-[#fff]" style={{ padding: "32px 24px" }}>
          <SectionLabel>O Programa</SectionLabel>
          <SectionTitle>
            Mais do que um treinamento. Uma <GradText>operação montada.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            O Prime é o programa completo da Onside para corretores que querem montar equipe comercial, estruturar
            processo de vendas e escalar com previsibilidade no mercado PME. Não é curso. É construção.
          </p>
          <ItemList
            items={[
              {
                title: "Duração de 100 dias",
                sub: "Acompanhamento contínuo do início da estruturação até os primeiros resultados consolidados.",
              },
              {
                title: "Contratação de até 7 SDRs",
                sub: "Seleção, contratação e onboarding de SDRs feitos pela Onside — com responsabilidade de reposição em caso de desistência ou desligamento.",
              },
              {
                title: "Estruturação comercial completa",
                sub: "Funil, scripts, playbooks, cadências de prospecção, processo de diagnóstico e fechamento.",
              },
              {
                title: "Corretor Studio (CRM)",
                sub: "Acesso à plataforma exclusiva com pipeline, gestão de carteira, agendamento automático e e-mail marketing.",
              },
            ]}
          />
        </div>

        {/* BLACKBOX */}
        <div className="prime-reveal border-b border-[#E4E0D8]" style={{ padding: "32px 24px", background: "#F6F4F0" }}>
          <SectionLabel>Plataforma de apoio</SectionLabel>
          <SectionTitle>
            Black Box <GradText>não é infoproduto.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            A Black Box é a plataforma de apoio contínuo ao corretor — um ambiente vivo de ferramentas, conteúdo
            aplicado e suporte direto. Não é curso gravado. É operação em tempo real.
          </p>
          <BbCard
            title="Central de Recursos Operacionais"
            desc="Scripts de abordagem, modelos de proposta, fluxos de diagnóstico, templates de e-mail e materiais de vendas atualizados conforme o mercado evolui."
            tag="Atualizada continuamente"
          />
          <BbCard
            title="Acervo de Casos e Estudos Reais"
            desc="Gravações de reuniões, análises de objeções reais e cases de fechamento com comentários dos facilitadores. Aprende-se vendo o que funciona de verdade."
            tag="Casos reais da operação"
          />
          <BbCard
            title="Suporte Integrado ao Time"
            desc="Ambiente de suporte direto para SDRs e Closers, com acesso aos facilitadores para dúvidas sobre objeções, abordagens e situações do funil em tempo real."
            tag="Suporte ativo"
          />
        </div>

        {/* ENCONTROS */}
        <div className="prime-reveal border-b border-[#E4E0D8] bg-[#fff]" style={{ padding: "32px 24px" }}>
          <SectionLabel>Comunidade · Calendário semanal</SectionLabel>
          <SectionTitle>
            Encontros que <GradText>movem a operação.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            A comunidade Backstage Club tem uma cadência semanal estruturada — não é um grupo de WhatsApp, é uma
            sala de operação ao vivo.
          </p>
          <div>
            <MeetingRow
              abbr="ter"
              day="Terça"
              title="Central de SDR"
              desc="Encontro semanal de suporte, treinamento e alinhamento exclusivo para SDRs. Aulas práticas, quebra de objeções ao vivo, análise de ligações e orientação de abordagem."
              bg="linear-gradient(135deg,#E8601C,#FF6900)"
            />
            <MeetingRow
              abbr="sex"
              day="Sexta"
              title="Encontro de Corretores"
              desc="Encontro semanal da comunidade Backstage Club. Cases, estratégias, análise de mercado e atualizações do ecossistema PME com Bruno Marcelino e os facilitadores."
              bg="linear-gradient(135deg,#C44010,#E8601C)"
            />
            <MeetingRow
              abbr="men"
              day="Mensal"
              title="HotSeats"
              desc="Sessão mensal de análise ao vivo de operações reais. Um membro apresenta o cenário da sua corretora e recebe análise coletiva da comunidade e de Bruno."
              bg="linear-gradient(135deg,#2B7A4B,#1A5233)"
            />
          </div>
        </div>

        {/* SDRs */}
        <div className="prime-reveal border-b border-[#E4E0D8]" style={{ padding: "32px 24px", background: "#F6F4F0" }}>
          <SectionLabel>Time comercial</SectionLabel>
          <SectionTitle>
            Contratação de SDR <GradText>do jeito certo.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            A Onside cuida de todo o processo — da seleção à operação. Não é indicação de currículo. É construção
            de time.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { n: "7", label: "SDRs contratados", sub: "Até 7 SDRs selecionados e integrados à sua operação no programa Prime." },
              { n: "100%", label: "Reposição garantida", sub: "Em caso de desistência ou desligamento, realizamos a reposição sem custo adicional." },
              { n: "Treina", label: "Capacitação completa", sub: "Scripts, simulações, cadências e onboarding guiado pela equipe Onside." },
              { n: "Monitora", label: "Acompanhamento ativo", sub: "Facilitadores assistem ligações, identificam gargalos e atuam em tempo real para quebrar objeções." },
            ].map((card, i) => (
              <div
                key={i}
                className="prime-sdr-card rounded-[9px] p-4 border border-[#E4E0D8] bg-[#fff] transition-colors duration-200"
              >
                <p
                  className="text-2xl font-medium tracking-[-0.02em] mb-1"
                  style={gradStyle}
                >
                  {card.n}
                </p>
                <p className="text-[11px]" style={{ color: "#52504A" }}>
                  {card.label}
                </p>
                <p className="text-[11px] font-light leading-[1.5] mt-1" style={{ color: "#9A978F" }}>
                  {card.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FACILITADORES */}
        <div className="prime-reveal border-b border-[#E4E0D8] bg-[#fff]" style={{ padding: "32px 24px" }}>
          <SectionLabel>Monitor de qualidade</SectionLabel>
          <SectionTitle>
            Facilitadores que <GradText>estão na trincheira.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            Os facilitadores da Onside não são professores de teoria. São profissionais que monitoram ligações
            reais, analisam conversas e intervêm para garantir qualidade operacional.
          </p>
          <ItemList
            items={[
              {
                title: "Monitoria de ligações ao vivo",
                sub: "Acompanhamento das chamadas dos SDRs com feedback imediato sobre tom, abordagem e qualificação.",
              },
              {
                title: "Quebra de objeções em tempo real",
                sub: "Suporte ativo durante abordagens difíceis — o facilitador orienta o SDR no momento certo, não depois.",
              },
              {
                title: "Análise de padrões e ajuste de script",
                sub: "Identificação de padrões de rejeição, objeções recorrentes e pontos de melhoria com atualização dos scripts.",
              },
              {
                title: "Relatório de performance do time",
                sub: "Acompanhamento individual dos SDRs com métricas de ligação, taxa de agendamento e qualidade de contato.",
              },
            ]}
          />
        </div>

        {/* CLOSERS */}
        <div className="prime-reveal border-b border-[#E4E0D8]" style={{ padding: "32px 24px", background: "#F6F4F0" }}>
          <SectionLabel>Treinamento de Closer</SectionLabel>
          <SectionTitle>
            Não vendemos plano.
            <br />
            <GradText>Assessoramos o empresário.</GradText>
          </SectionTitle>
          <p className="text-[13px] font-light leading-[1.7] mb-5" style={{ color: "#52504A" }}>
            O treinamento de Closer da Onside é uma virada de chave. O foco sai completamente do produto — rede
            credenciada, coparticipação, operadora — e vai para o que realmente fecha: uma assessoria consultiva e
            adequada ao perfil do empresário.
          </p>
          <BbCard
            title="Consultoria antes de proposta"
            desc="O Closer aprende a conduzir um diagnóstico completo da empresa antes de apresentar qualquer número. O cliente compra a solução, não o plano."
            tag="Diagnóstico first"
          />
          <BbCard
            title="Posicionamento de assessoria"
            desc="O Closer não é um vendedor de tabela. É um especialista em benefícios PME que orienta o empresário a tomar a melhor decisão para sua empresa e seus colaboradores."
            tag="Autoridade consultiva"
          />
          <BbCard
            title="Reunião estruturada de fechamento"
            desc="Metodologia de reunião online com etapas definidas: abertura, levantamento de dores, apresentação de valor, manejo de objeções e fechamento. Cada etapa treinada e monitorada pelos facilitadores."
            tag="Metodologia Onside"
          />

          {/* 65% stat */}
          <div
            className="mt-5 rounded-[14px] p-6 text-center border border-[#E4E0D8]"
            style={{ background: "#fff" }}
          >
            <p
              className="text-[11px] font-medium tracking-[.08em] uppercase mb-2.5"
              style={{ color: "#9A978F" }}
            >
              Resultado do time treinado
            </p>
            <p
              className="text-[52px] font-medium tracking-[-0.03em] leading-none"
              style={gradStyle}
            >
              65%
            </p>
            <p className="text-[14px] font-medium mt-2 mb-1.5" style={{ color: "#181612" }}>taxa de conversão média</p>
            <p
              className="text-[12px] font-light max-w-[340px] mx-auto"
              style={{ color: "#9A978F" }}
            >
              Média atingida pelos Closers que passam pelo treinamento completo da Onside e seguem a metodologia
              de assessoria.
            </p>
          </div>
        </div>

        {/* GARANTIA */}
        <div className="prime-reveal border-b border-[#E4E0D8] bg-[#fff]" style={{ padding: "32px 24px" }}>
          <SectionLabel>Garantia contratual</SectionLabel>
          <div
            className="rounded-[14px] p-7 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, var(--prime-dark), var(--prime-dark2))" }}
          >
            {/* rings */}
            <div
              aria-hidden
              className="absolute rounded-full border pointer-events-none"
              style={{
                width: 280,
                height: 280,
                top: -80,
                right: -80,
                borderColor: "color-mix(in srgb, var(--prime-o2) 15%, transparent)",
              }}
            />
            <div
              aria-hidden
              className="absolute rounded-full border pointer-events-none"
              style={{
                width: 180,
                height: 180,
                bottom: -60,
                left: -60,
                borderColor: "color-mix(in srgb, var(--prime-o2) 15%, transparent)",
              }}
            />
            <Shield className="mb-3 relative z-[2]" size={32} style={{ color: "var(--prime-o4)" }} />
            <h3 className="text-[18px] font-medium text-white leading-[1.3] mb-2.5 relative z-[2]">
              Se você não recuperar os{" "}
              <span style={gradGold}>R$ 15.000</span> em 100 dias,
            </h3>
            <p className="text-[13px] font-light leading-[1.7] mb-4 relative z-[2]" style={{ color: "rgba(255,255,255,0.7)" }}>
              haverá renovação contratual automática sem novas cobranças — até que o investimento seja recuperado.
              Nosso compromisso não termina no dia 100. Termina quando o resultado chegar.
            </p>
            <div
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-1.5 rounded-full border relative z-[2]"
              style={{
                background: "color-mix(in srgb, var(--prime-o2) 15%, transparent)",
                borderColor: "color-mix(in srgb, var(--prime-o2) 25%, transparent)",
                color: "var(--prime-o4)",
              }}
            >
              Renovação automática · sem custo adicional
            </div>
          </div>
        </div>

        {/* CHECKLIST */}
        <div className="prime-reveal border-b border-[#E4E0D8]" style={{ padding: "32px 24px", background: "#F6F4F0" }}>
          <SectionLabel>O que está incluído</SectionLabel>
          <SectionTitle>
            Tudo que o <GradText>Prime entrega.</GradText>
          </SectionTitle>
          <div className="flex flex-col">
            {[
              "Backstage Club — acesso completo",
              "Plataforma Black Box",
              "Encontros terça e sexta — semanais",
              "Central de SDR — toda terça-feira",
              "One a One quinzenal com Bruno Marcelino",
              "HotSeats mensal",
              "Suporte ativo",
              "Estruturação comercial completa",
              "Corretor Studio — CRM exclusivo",
              "Contratação de até 7 SDRs com reposição",
              "Capacitação e treinamento do time",
              "Monitoria de qualidade com facilitadores",
              "Configuração de discadora automática",
              "Garantia de recuperação em 100 dias",
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-[11px] border-b border-[#E4E0D8] last:border-0 text-[13px]"
                style={{ color: "#181612" }}
              >
                <div
                  className="size-[22px] rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--prime-o2), var(--prime-o3))" }}
                >
                  <Check size={11} strokeWidth={2.5} className="text-white" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* PAGAMENTO */}
        <div className="prime-reveal border-b border-[#E4E0D8] bg-[#fff]" style={{ padding: "32px 24px" }}>
          <SectionLabel>Formas de pagamento</SectionLabel>
          <SectionTitle>
            Escolha a melhor <GradText>forma de entrada.</GradText>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[14px] p-5 text-center border border-[#E4E0D8] bg-[#fff]">
              <p className="text-[10px] font-medium tracking-[.08em] uppercase mb-2" style={{ color: "#9A978F" }}>
                Cartão de crédito
              </p>
              <p className="text-[26px] font-medium tracking-[-0.025em] mb-1" style={gradStyle}>
                R$ 15.000
              </p>
              <p className="text-[12px] font-light leading-[1.5]" style={{ color: "#52504A" }}>
                4x de R$ 3.750
                <br />
                sem juros
              </p>
              <span
                className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-[4px] mt-2"
                style={{
                  background: "color-mix(in srgb, var(--prime-o2) 10%, transparent)",
                  color: "var(--prime-o2)",
                }}
              >
                Sem acréscimo
              </span>
            </div>
            <div
              className="prime-pag-card-destaque rounded-[14px] p-5 text-center relative overflow-hidden border"
              style={{
                borderColor: "color-mix(in srgb, var(--prime-o2) 30%, transparent)",
                boxShadow: "0 4px 20px color-mix(in srgb, var(--prime-o2) 10%, transparent)",
                background: "#fff",
              }}
            >
              <p className="text-[10px] font-medium tracking-[.08em] uppercase mb-2" style={{ color: "#9A978F" }}>
                Pix à vista
              </p>
              <p className="text-[26px] font-medium tracking-[-0.025em] mb-1" style={gradStyle}>
                R$ 14.000
              </p>
              <p className="text-[12px] font-light leading-[1.5]" style={{ color: "#52504A" }}>
                Pagamento único
                <br />
                economia de R$ 1.000
              </p>
              <span
                className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-[4px] mt-2"
                style={{
                  background: "color-mix(in srgb, var(--prime-o2) 10%, transparent)",
                  color: "var(--prime-o2)",
                }}
              >
                Melhor condição
              </span>
            </div>
          </div>
        </div>

        {/* CONDIÇÕES CONTRATUAIS */}
        <div className="prime-reveal border-b border-[#E4E0D8]" style={{ padding: "32px 24px", background: "#F6F4F0" }}>
          <SectionLabel>Condições contratuais</SectionLabel>
          <SectionTitle>
            O que o contrato <GradText>prevê.</GradText>
          </SectionTitle>
          <AnexoCard
            icon={<FileText size={16} style={iconColor} />}
            title="Contratação de até 7 SDRs"
            sub="A Onside realiza todo o processo seletivo, contratação e onboarding dos SDRs. Em caso de desistência ou desligamento durante o programa, a reposição é realizada sem custo adicional."
          />
          <AnexoCard
            icon={<RefreshCw size={16} style={iconColor} />}
            title="Garantia de recuperação do investimento"
            sub="Se ao final dos 100 dias o contratante não tiver recuperado o valor investido (R$ 15.000), o programa é renovado automaticamente sem novas cobranças até que o resultado seja atingido."
          />
          <AnexoCard
            icon={<Calendar size={16} style={iconColor} />}
            title="Período de 100 dias corridos"
            sub="O programa inicia na data de ativação do contrato e se estende por 100 dias com acompanhamento contínuo. O cronograma de encontros e entregas é definido no onboarding inicial."
          />
          <AnexoCard
            icon={<Handshake size={16} style={iconColor} />}
            title="Responsabilidade de acompanhamento"
            sub="A Onside se compromete com presença ativa nos encontros semanais, monitoria do time de SDRs, ajuste de scripts e suporte via facilitadores durante todo o período contratado."
          />
        </div>

        {/* CTA FINAL */}
        <div
          className="relative overflow-hidden text-center"
          style={{ padding: "40px 24px", background: "linear-gradient(145deg, var(--prime-dark), var(--prime-dark2))" }}
        >
          <div
            aria-hidden
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: 400,
              height: 400,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              borderColor: "color-mix(in srgb, var(--prime-o2) 12%, transparent)",
            }}
          />
          <div
            aria-hidden
            className="absolute rounded-full border pointer-events-none"
            style={{
              width: 600,
              height: 600,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              borderColor: "color-mix(in srgb, var(--prime-o2) 12%, transparent)",
            }}
          />
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              width: 300,
              height: 150,
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              background: "radial-gradient(ellipse, color-mix(in srgb, var(--prime-o2) 20%, transparent) 0%, transparent 70%)",
            }}
          />
          <h2
            className="font-medium text-white leading-[1.2] tracking-[-0.02em] mb-2.5 relative z-[2]"
            style={{ fontSize: "clamp(22px,5vw,34px)" }}
          >
            Pronto para montar sua
            <br />
            <span style={gradGold}>operação de verdade?</span>
          </h2>
          <p className="text-[13px] font-light mb-7 relative z-[2]" style={{ color: "rgba(255,255,255,0.55)" }}>
            100 dias. Equipe montada. Processo rodando. Garantia de retorno.
          </p>
          <a
            href="https://wa.me/5511939534668"
            className={cn(
              "prime-btn-cta inline-block px-9 py-3.5 rounded-full text-white font-medium text-[14px] no-underline relative z-[2]",
              "transition-[filter,transform] duration-200"
            )}
            style={{
              background: "linear-gradient(135deg, var(--prime-o2), var(--prime-o3))",
              boxShadow: "0 4px 20px color-mix(in srgb, var(--prime-o2) 35%, transparent)",
            }}
          >
            Quero entrar no Prime
          </a>
          <p className="text-[11px] mt-3.5 relative z-[2]" style={{ color: "rgba(255,255,255,0.4)" }}>
            R$ 14.000 no Pix · ou 4x R$ 3.750 no cartão
          </p>
        </div>

        {/* FOOTER */}
        <footer
          className="text-center text-[12px] border-t border-[#E4E0D8]"
          style={{ padding: "24px", background: "#fff", color: "#9A978F" }}
        >
          Onside Ltda · <span style={{ color: "var(--prime-o2)" }}>Backstage Club</span> · Barueri, SP ·
          @brunomarceliino
        </footer>
      </div>
    </>
  )
}
