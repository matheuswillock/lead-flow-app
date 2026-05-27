/* AppShell.jsx — sidebar + topbar for the logged-in CRM surface */

function NavItem({ icon, label, active, pill, onClick }) {
  return (
    <a className={cn('cs-nav-item', active && 'is-active')} onClick={onClick}>
      <span className="cs-nav-item__icon"><Icon name={icon} size={16} /></span>
      <span>{label}</span>
      {pill && <span className="cs-nav-item__pill">{pill}</span>}
    </a>
  );
}

function AppShell({ active, onNavigate, children, title, crumb, actions }) {
  return (
    <div className="cs-app">
      <aside className="cs-sidebar">
        <div className="cs-sidebar__brand"><Logo size={28} /></div>

        <div className="cs-sidebar__ws">
          <div className="cs-sidebar__ws-meta">
            <Avatar name="Acme Corretora" size={20} idx={0} />
            <span>Acme Corretora</span>
          </div>
          <Icon name="chevDown" size={14} />
        </div>

        <div className="cs-group-label">Navegação <Icon name="chevDown" size={12} /></div>
        <NavItem icon="layout"      label="Dashboard"           active={active==='dashboard'} onClick={()=>onNavigate('dashboard')} />
        <NavItem icon="users"       label="CRM"                 active={active==='board'} onClick={()=>onNavigate('board')} />
        <NavItem icon="calendar"    label="Calendário"          />
        <NavItem icon="barchart"    label="Performance"         pill="Beta" />
        <NavItem icon="calculator"  label="Simulador de Planos" />
        <NavItem icon="briefcase"   label="Carteira"            />

        <div className="cs-group-label">Email <Icon name="chevDown" size={12} /></div>
        <NavItem icon="fileText" label="Templates" pill="Em breve" />
        <NavItem icon="bookUser" label="Contatos"  pill="Em breve" />
        <NavItem icon="send"     label="Campanhas" pill="Em breve" />
        <NavItem icon="history"  label="Histórico" />
        <NavItem icon="barchart" label="Analytics" pill="Em breve" />

        <div className="cs-group-label">Integrações</div>
        <NavItem icon="plug" label="Webhooks & Formulários" />

        <div className="cs-group-label">Time</div>
        <NavItem icon="users" label="Gerenciar Usuários" />
      </aside>

      <main className="cs-main">
        <header className="cs-topbar">
          <span className="cs-topbar__title">{title}</span>
          {crumb && <span className="cs-topbar__crumb">{crumb}</span>}
          <div className="cs-topbar__spacer" />
          <div className="cs-topbar__search">
            <Icon name="search" size={14} />
            <input placeholder="Buscar leads, reuniões, operadores…" />
          </div>
          <Button variant="icon" aria-label="Notificações"><Icon name="bell" size={16} /></Button>
          <Avatar name="Bruno Marcelino" size={32} idx={4} />
        </header>

        {children}
      </main>
    </div>
  );
}

Object.assign(window, { AppShell, NavItem });
