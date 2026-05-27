/* LandingScreen.jsx — marketing site recreation */

function HeroVisual() {
  return (
    <div className="cs-hero-visual">
      <div className="cs-hero-visual__float cs-hero-visual__float--tl">
        <Icon name="plus" size={14} />Novo lead no pipeline
      </div>
      <div className="cs-hero-visual__frame cs-hero-visual__frame--image">
        <img
          src="../../assets/product-banner.svg"
          alt="Corretor Studio — pipeline e gestão de leads"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
        />
      </div>
      <div className="cs-hero-visual__float cs-hero-visual__float--br">
        <Icon name="checkCircle" size={14} />Reunião agendada
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, bullets, embreve, large }) {
  return (
    <Card variant="feature" className={cn('cs-feat', large && 'cs-feat--lg')}>
      {embreve && <span className="cs-feat__embreve">Em breve</span>}
      <div className="cs-feat__icon"><Icon name={icon} size={large ? 28 : 22} /></div>
      <h3 className="cs-feat__title">{title}</h3>
      <p className="cs-feat__desc">{desc}</p>
      {bullets && (
        <ul className="cs-feat__bullets">
          {bullets.map((b, i) => (
            <li key={i}><Icon name="arrowRight" size={14} />{b}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LandingScreen({ onEnterApp }) {
  return (
    <div className="cs-landing">
      <header className="cs-lp-header">
        <div className="cs-lp-header__inner">
          <Logo size={28} />
          <nav className="cs-lp-nav">
            <a href="#features">Funcionalidades</a>
            <a href="#campanhas">Campanhas</a>
            <a href="#como">Como funciona</a>
            <a href="#demo">Demonstração</a>
          </nav>
          <Button variant="ghost" size="sm">Entrar</Button>
          <Button variant="primary" size="md" trailingIcon={<Icon name="arrowRight" size={14}/>} onClick={onEnterApp}>
            Agendar demonstração
          </Button>
        </div>
      </header>

      <section className="cs-lp-hero">
        <div className="cs-lp-hero__bg-dots" />
        <div className="cs-lp-hero__bg-orbs" />
        <div className="cs-lp-hero__fade" />
        <div className="cs-lp-hero__inner">
          <div>
            <div className="cs-hero-pill">
              <span className="dot" />
              <b>Em breve</b>
              <em>Campanhas de Email no Corretor Studio</em>
              <Icon name="arrowRight" size={12} />
            </div>
            <h1>
              <span className="pre">Corretores comuns mandam cotações.</span>
              <span className="main">
                Os de <span className="cs-gradient-text" style={{ fontWeight: 800 }}>ALTA PERFORMANCE</span><br/>
                usam Corretor Studio.
              </span>
            </h1>
            <p className="sub">
              Enquanto outros perdem leads no WhatsApp e em planilhas, seu time opera com{' '}
              <b>pipeline</b>, <b>agenda</b> e <b>indicadores</b> tudo em um só lugar para não ficar para trás.
            </p>
            <div className="cs-hero-cta">
              <Button variant="primary" size="lg" trailingIcon={<Icon name="arrowRight" size={16}/>} onClick={onEnterApp}>
                Agendar demonstração
              </Button>
              <Button variant="secondary" size="lg">Ver como funciona</Button>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="cs-lp-bento" id="features">
        <div className="cs-lp-bento__head">
          <h2>Tudo que você precisa para <span className="cs-gradient-text">vender mais</span></h2>
          <p>CRM completo hoje, com módulo de campanhas de email chegando em breve.</p>
        </div>
        <div className="cs-lp-bento__grid">
          <FeatureCard large icon="kanban" title="Pipeline Kanban + Tabela"
            desc="Organize o funil com duas visões: Kanban para mover etapas e tabela para revisar todos os leads."
            bullets={[
              'Arraste e solte por etapa',
              'Visão em lista com filtros rápidos',
              'Status e responsáveis sempre visíveis',
              'Detalhes completos do lead em um clique',
            ]} />
          <FeatureCard icon="calendar" title="Calendário & Reuniões"
            desc="Agenda diária/semanal com agendamentos integrados ao Google Calendar." />

          <FeatureCard icon="users" title="Times / Workspaces"
            desc="Separe operações por time e alterne o workspace ativo com um clique." />
          <FeatureCard large embreve icon="mail" title="Campanhas de Email"
            desc="Em breve: campanhas segmentadas para listas de contatos com editor visual, agendamento automático e analytics."
            bullets={[
              'Editor visual drag-and-drop (Maily)',
              'Upload de listas via CSV',
              'Agendamento de disparos',
              'Métricas de abertura, clique e entrega',
            ]} />

          <FeatureCard icon="barchart" title="Dashboard & Métricas"
            desc="KPIs, gráficos e indicadores para acompanhar a performance da equipe." />
          <FeatureCard icon="users" title="Gestão de Operadores"
            desc="Cadastre operadores, defina funções (SDR/Closer) e controle acessos." />
          <FeatureCard icon="paperclip" title="Anexos por Lead"
            desc="Guarde contratos, imagens e documentos junto ao lead com acesso direto." />
        </div>
      </section>

      <section className="cs-lp-demo" id="demo">
        <div className="cs-lp-demo__bg" />
        <div className="cs-lp-demo__inner">
          <div className="cs-lp-demo__head">
            <h2>Agende uma <b>demonstração</b></h2>
            <p style={{ marginBottom: 24, color: 'var(--muted-foreground)' }}>
              Fale com um especialista e veja o Corretor Studio em ação.
            </p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>
              Por que usar o Corretor Studio?
            </h3>
            <p style={{ color: 'var(--muted-foreground)', margin: '0 0 22px', fontSize: 14 }}>
              Veja o que os corretores de alta performance têm de diferente.
            </p>
            <ul className="cs-lp-demo__bens">
              <li><span className="ico"><Icon name="kanban" size={16}/></span>Pipeline Kanban visual e intuitivo</li>
              <li><span className="ico"><Icon name="calendar" size={16}/></span>Integração nativa com Google Calendar</li>
              <li><span className="ico"><Icon name="users" size={16}/></span>Gestão de times: SDR, Closer e Manager</li>
              <li><span className="ico"><Icon name="barchart" size={16}/></span>Dashboard com métricas em tempo real</li>
              <li><span className="ico"><Icon name="mail" size={16}/></span>Módulo de campanhas de email <span className="cs-gradient-text" style={{ fontWeight: 600 }}>(em breve)</span></li>
              <li><span className="ico"><Icon name="lifebuoy" size={16}/></span>Suporte em português, sem complicação</li>
            </ul>
          </div>

          <Card variant="feature" className="cs-lp-demo__form">
            <form onSubmit={(e) => { e.preventDefault(); onEnterApp(); }}>
              <Input label="Nome completo"        placeholder="Seu nome" defaultValue="Bruno Marcelino" />
              <Input label="E-mail profissional"  placeholder="seu@email.com" defaultValue="bruno@acmecorretora.com.br" />
              <Input label="WhatsApp"             placeholder="(00) 00000-0000" defaultValue="(11) 98765-4321" />
              <Button variant="primary" size="lg" trailingIcon={<Icon name="arrowRight" size={16}/>}>
                Agendar demonstração
              </Button>
            </form>
            <div className="cs-lp-demo__trust">
              <Icon name="checkCircle" size={13} />
              <span>Resposta em até 24 horas · Sem compromisso · Demonstração gratuita</span>
            </div>
          </Card>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
        © 2026 Corretor Studio · CRM para corretores de planos de saúde · Feito com ♥ no Brasil
      </footer>
    </div>
  );
}

Object.assign(window, { LandingScreen, FeatureCard, HeroVisual });
