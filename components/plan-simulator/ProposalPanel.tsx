import Image from "next/image";
import { BAND_KEYS, brl, copShort, faixaLabel, reembolsoOf } from "./format";
import { IconCheck, IconX } from "./Icons";

export type ProposalItem = {
  chave: string;
  operadora: string;
  logoPath: string;
  plano: string;
  tabela: string;
  acomodacao: string;
  contratacao: string;
  coparticipacao: string;
  coparticipacaoTabela: string;
  aceitaMei: boolean;
  vidasMin: number;
  vidasMax: number;
  precos: Record<string, number>;
  regras?: { tipo: string; texto: string }[];
  total: number | null;
  /** Plano que não aparece nos filtros atuais (só o nome é conhecido). */
  foraDosFiltros?: boolean;
};

type Props = {
  client: boolean;
  items: ProposalItem[];
  lives: number[];
  onOpen: (chave: string) => void;
  onRemove?: (chave: string) => void;
  onClear?: () => void;
  clearArmed?: boolean;
  onConfirmClear?: () => void;
};

const totalVidas = (lives: number[]) => lives.reduce((a, b) => a + b, 0);

/** Proposta: os planos que o corretor escolheu para o cliente (ou a visão de leitura do cliente). */
export function ProposalPanel({ client, items, lives, onOpen, onRemove, onClear, clearArmed, onConfirmClear }: Props) {
  const n = totalVidas(lives);
  const hasSel = items.length > 0;
  const sorted = [...items].sort((a, b) => (a.total ?? 1e12) - (b.total ?? 1e12));
  const usedBands = BAND_KEYS.map((_, i) => i).filter((i) => (lives[i] ?? 0) > 0);

  const head = (
    <div className="head">
      <div className="ic"><IconCheck /></div>
      <div className="grow">
        <h2 id="h-p">{client ? "Planos selecionados para você" : "Proposta para o cliente"}</h2>
        <p>
          {client
            ? `${sorted.length} ${sorted.length === 1 ? "opção escolhida" : "opções escolhidas"} pelo seu corretor. Toque em Ver detalhes para ver rede, carências, coparticipação e reembolso.`
            : hasSel
              ? `${sorted.length} ${sorted.length === 1 ? "plano escolhido" : "planos escolhidos"}. É isso que o cliente vai ver.`
              : "Ainda vazia. Abra uma operadora e clique em Incluir nos planos que quer mandar ao cliente."}
        </p>
      </div>
      {!client && hasSel && onClear ? (
        <button type="button" className="linkbtn" onClick={clearArmed ? onConfirmClear : onClear}>
          {clearArmed ? "Confirmar: limpar tudo" : "Limpar proposta"}
        </button>
      ) : null}
    </div>
  );

  if (!hasSel) {
    return <section className="card prop empty-prop" aria-labelledby="h-p">{head}</section>;
  }

  return (
    <section className="card prop" aria-labelledby="h-p">
      {head}
      <div className="plist">
        {sorted.map((p, k) => {
          const warn: string[] = [];
          if (p.foraDosFiltros) warn.push("fora dos filtros atuais");
          if (p.vidasMin && n < p.vidasMin) warn.push(`exige ${p.vidasMin} vidas`);
          if (p.vidasMax && n > p.vidasMax) warn.push(`até ${p.vidasMax} vidas`);
          if (p.total == null) warn.push("sem preço para alguma faixa");
          const best = k === 0 && sorted.length > 1;
          return (
            <div key={p.chave} className={`pitem${best ? " best" : ""}`}>
              <span className="plogo"><Image src={p.logoPath} alt={p.operadora} width={80} height={30} unoptimized /></span>
              <div className="pinfo">
                <div className="pn">{p.plano}{best ? <span className="tag acc"> Menor preço</span> : null}</div>
                <div className="ps">{p.operadora} · {p.tabela}</div>
                <div className="tags">
                  <span className="tag">{p.acomodacao}</span>
                  <span className={`tag ${/^sem/i.test(p.coparticipacao) ? "ok" : "warn"}`}>{copShort(p.coparticipacao)}</span>
                  <span className="tag alt">{p.contratacao}</span>
                  <span className="tag">{reembolsoOf(p.tabela, p.regras ?? []).replace(" (ver tabela)", "")}</span>
                  {warn.map((w) => (<span key={w} className="tag warn">{w}</span>))}
                </div>
                <div className="pfx">
                  {usedBands.map((i) => (
                    <span key={i}>{faixaLabel(BAND_KEYS[i])}: <b>{lives[i] > 1 ? `${lives[i]} × ` : ""}{brl(p.precos[BAND_KEYS[i]])}</b></span>
                  ))}
                </div>
              </div>
              <div className="pval">
                <small>total mensal</small>
                <b className="tn">{brl(p.total)}</b>
                <small>{n} {n === 1 ? "vida" : "vidas"}</small>
              </div>
              <div className="pacts">
                <button type="button" className="btn" onClick={() => onOpen(p.chave)}>Ver detalhes</button>
                {!client && onRemove ? (
                  <button type="button" className="pdel" onClick={() => onRemove(p.chave)} aria-label={`Tirar ${p.plano} da proposta`}><IconX /></button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

