/* DashboardScreen.jsx — Metrics, chart, upcoming meetings */

function MetricCard({ tone = 'app', label, value, delta, trend, sub }) {
  const toneClass = tone === 'app' ? '' : `cs-metric--${tone}`;
  return (
    <div className={cn('cs-metric', toneClass)}>
      <div className="cs-metric__label">
        {label}
        {sub && <Badge tone="neutral">{sub}</Badge>}
      </div>
      <div className="cs-metric__value">{value}</div>
      {delta && (
        <div className="cs-metric__delta">
          <Icon name={trend === 'down' ? 'trendDown' : 'trendUp'} size={13} />
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

/* Area chart — hand-coded SVG, no Recharts */
function AreaChart() {
  // 14 weekly points
  const data    = [22, 28, 25, 32, 38, 30, 36, 42, 48, 44, 52, 58, 64, 71];
  const data2   = [12, 14, 13, 17, 19, 16, 19, 22, 25, 23, 28, 30, 33, 38]; // wins
  const W = 720, H = 220, P = 14;
  const max = Math.max(...data) * 1.1;
  const x = i => P + (i * (W - 2*P) / (data.length - 1));
  const y = v => H - P - ((v / max) * (H - 2*P));
  const linePath = (arr) => arr.map((v,i) => `${i===0?'M':'L'} ${x(i)} ${y(v)}`).join(' ');
  const areaPath = (arr) => `${linePath(arr)} L ${x(arr.length-1)} ${H-P} L ${x(0)} ${H-P} Z`;
  return (
    <svg className="cs-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ff6900" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff6900" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="winsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#cd6cdd" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#cd6cdd" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((p, i) => (
        <line key={i} x1={P} x2={W-P} y1={P + (H-2*P)*p} y2={P + (H-2*P)*p}
          stroke="var(--border)" strokeDasharray="3 4" />
      ))}
      <path d={areaPath(data)}  fill="url(#leadsGrad)" />
      <path d={linePath(data)}  fill="none" stroke="#ff6900" strokeWidth="2" strokeLinecap="round" />
      <path d={areaPath(data2)} fill="url(#winsGrad)" />
      <path d={linePath(data2)} fill="none" stroke="#cd6cdd" strokeWidth="2" strokeLinecap="round" strokeDasharray="0" />
      {/* current point */}
      <circle cx={x(data.length-1)} cy={y(data[data.length-1])} r="5" fill="#ff6900" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function MeetingRow({ day, mon, title, who, mode }) {
  return (
    <div className="cs-meet">
      <div className="cs-meet__date">
        <div className="day">{day}</div>
        <div className="mon">{mon}</div>
      </div>
      <div className="cs-meet__body">
        <div className="cs-meet__title">{title}</div>
        <div className="cs-meet__sub">
          <Icon name={mode === 'video' ? 'video' : 'users'} size={12} />
          <span>{who}</span>
        </div>
      </div>
      <Button variant="secondary" size="sm" leadingIcon={<Icon name="video" size={13} />}>Entrar</Button>
    </div>
  );
}

function DashboardScreen() {
  const [tab, setTab] = useState('30d');
  return (
    <div className="cs-dash">
      <div className="cs-dash__head">
        <div>
          <h1>Bom dia, Bruno 👋</h1>
          <p>3 reuniões hoje · 7 leads aguardando primeiro contato</p>
        </div>
        <Button variant="primary" size="md" leadingIcon={<Icon name="plus" size={16}/>}>Novo lead</Button>
      </div>

      <div className="cs-metric-grid">
        <MetricCard tone="success" label="Leads novos · 30d"      value="184" delta="+12,4% vs período anterior" trend="up" />
        <MetricCard tone="warning" label="Tempo médio fechamento" value="6,2d" delta="+0,8d vs período anterior" trend="up" />
        <MetricCard tone="info"    label="Taxa de conversão"      value="22%"  delta="+3pp vs período anterior" trend="up" />
        <MetricCard tone="new"     label="Receita projetada"      value="R$ 84.320" delta="−4,1% vs período anterior" trend="down" sub="MRR" />
      </div>

      <div className="cs-chart-card">
        <div className="cs-chart-card__head">
          <div>
            <h3 className="cs-chart-card__title">Pipeline ao longo do tempo</h3>
            <p className="cs-chart-card__sub">Leads novos vs contratos fechados — últimas 14 semanas</p>
          </div>
          <div className="cs-chart-tabs">
            <button className={cn(tab==='7d'  && 'is-active')} onClick={()=>setTab('7d')}>7d</button>
            <button className={cn(tab==='30d' && 'is-active')} onClick={()=>setTab('30d')}>30d</button>
            <button className={cn(tab==='90d' && 'is-active')} onClick={()=>setTab('90d')}>90d</button>
          </div>
        </div>
        <AreaChart />
        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-body)', marginTop: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ff6900' }} />Leads novos
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#cd6cdd' }} />Contratos fechados
          </span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: 0 }}>Próximas reuniões</h3>
          <Button variant="ghost" size="sm" trailingIcon={<Icon name="arrowRight" size={13}/>}>Ver calendário</Button>
        </div>
        <div className="cs-meet-list">
          <MeetingRow day="26" mon="MAI" title="Felipe Moura — Amil 12 vidas"      who="Bruno (closer) · 14:30" mode="video" />
          <MeetingRow day="26" mon="MAI" title="Construtora Vega — Bradesco 40"     who="Patricia (closer) · 16:00" mode="video" />
          <MeetingRow day="27" mon="MAI" title="Lúcia Tavares — Porto Individual"   who="Bruno (closer) · 10:00" mode="users" />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen, MetricCard });
