/* KanbanScreen.jsx — Lead pipeline board */

const INITIAL_LEADS = {
  new_opportunity: [
    { id: 'CS-0241', name: 'Carla Andrade',        days: 1, attach: 0, avatar: 0, plan: 'Hapvida · Familiar' },
    { id: 'CS-0252', name: 'Mariana Souza',        days: 0, attach: 1, avatar: 2, plan: 'Bradesco · Individual' },
    { id: 'CS-0260', name: 'Rodrigo Vilar',        days: 0, attach: 0, avatar: 1, plan: 'Sulamerica · Empresarial' },
  ],
  scheduled: [
    { id: 'CS-0235', name: 'Felipe Moura',         days: 3, attach: 2, avatar: 3, plan: 'Amil · 12 vidas',     overdue: true },
    { id: 'CS-0238', name: 'Patrícia Mendes',      days: 2, attach: 1, avatar: 5, plan: 'Unimed · Familiar' },
  ],
  in_negotiation: [
    { id: 'CS-0220', name: 'Construtora Vega',     days: 5, attach: 4, avatar: 0, plan: 'Bradesco · 40 vidas' },
    { id: 'CS-0224', name: 'Lúcia Tavares',        days: 6, attach: 1, avatar: 4, plan: 'Porto · Individual' },
  ],
  offer_submission: [
    { id: 'CS-0210', name: 'Restaurante Bistrot',  days: 9, attach: 3, avatar: 2, plan: 'Hapvida · 8 vidas' },
  ],
  closed_won: [
    { id: 'CS-0195', name: 'Joaquim Pereira',      days: 12, attach: 5, avatar: 1, plan: 'Unimed · Familiar' },
    { id: 'CS-0198', name: 'Cintia Reis',          days: 11, attach: 2, avatar: 3, plan: 'Sulamerica · Individual' },
  ],
};

const COLUMNS = [
  { key: 'new_opportunity', label: 'Nova oportunidade' },
  { key: 'scheduled',       label: 'Reunião agendada' },
  { key: 'in_negotiation',  label: 'Em negociação' },
  { key: 'offer_submission',label: 'Envio de proposta' },
  { key: 'closed_won',      label: 'Contrato fechado' },
];

function LeadCard({ lead, onAdvance }) {
  return (
    <div className={cn('cs-lead', lead.overdue && 'is-overdue')} onClick={onAdvance}>
      <div className="cs-lead__name">{lead.name}</div>
      <div className="cs-lead__meta">
        <span className="cs-id-pill">{lead.id}</span>
        <span>· {lead.plan}</span>
      </div>
      <div className="cs-lead__meta" style={{ marginTop: 2 }}>
        <Icon name="clock" size={12} />
        <span>{lead.days === 0 ? 'hoje' : `${lead.days}d no estágio`}</span>
        {lead.overdue && <Badge tone="danger">Atrasado</Badge>}
      </div>
      <div className="cs-lead__footer">
        {lead.attach > 0
          ? <span className="cs-lead__attach"><Icon name="paperclip" size={12} />{lead.attach}</span>
          : <span />}
        <Avatar name={lead.name} size={22} idx={lead.avatar} />
      </div>
    </div>
  );
}

function KanbanScreen() {
  const [leads, setLeads] = useState(INITIAL_LEADS);

  const advance = (fromKey, leadId) => {
    const fromIdx = COLUMNS.findIndex(c => c.key === fromKey);
    if (fromIdx === COLUMNS.length - 1) return;
    const toKey = COLUMNS[fromIdx + 1].key;
    setLeads(prev => {
      const lead = prev[fromKey].find(l => l.id === leadId);
      if (!lead) return prev;
      return {
        ...prev,
        [fromKey]: prev[fromKey].filter(l => l.id !== leadId),
        [toKey]:  [{ ...lead, days: 0, overdue: false }, ...prev[toKey]],
      };
    });
  };

  const total = Object.values(leads).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="cs-board">
      <div className="cs-board__head">
        <div className="cs-board__head-l">
          <Icon name="scroll" size={22} />
          <div>
            <h1 className="cs-board__title">CRM — Pipeline</h1>
            <div className="cs-board__sub">{total} leads ativos · Acme Corretora</div>
          </div>
        </div>
        <div className="cs-board__filters">
          <Button variant="secondary" size="sm" leadingIcon={<Icon name="filter" size={14}/>}>Filtros</Button>
          <Button variant="icon" aria-label="Configurações"><Icon name="settings" size={16}/></Button>
          <Button variant="primary" size="md" leadingIcon={<Icon name="plus" size={16}/>}>Novo lead</Button>
        </div>
      </div>

      <div className="cs-columns cs-scroll">
        {COLUMNS.map(col => (
          <section className="cs-col" key={col.key}>
            <header className="cs-col__head">
              <h2>{col.label}</h2>
              <span className="cs-col__count">{leads[col.key].length}</span>
            </header>
            <div className="cs-col__body">
              {leads[col.key].map(lead => (
                <LeadCard key={lead.id} lead={lead} onAdvance={() => advance(col.key, lead.id)} />
              ))}
              {leads[col.key].length === 0 && (
                <div style={{
                  border: '1px dashed var(--border)', borderRadius: 12, padding: 14,
                  fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center',
                  fontFamily: 'var(--font-body)'
                }}>Solte um lead aqui</div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-body)', textAlign: 'right' }}>
        Clique em um lead para movê-lo para a próxima etapa
      </div>
    </div>
  );
}

Object.assign(window, { KanbanScreen, LeadCard });
