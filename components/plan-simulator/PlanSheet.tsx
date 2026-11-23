"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { normText } from "@/lib/planSimulator/richText";
import { ACOM_INFO, BAND_KEYS, brl, copInfo, copShort, faixaLabel, LEGENDA_ATENDIMENTO, reembolsoOf } from "./format";
import { IconArrow, IconCheck, IconCopy, IconHospital, IconLab, IconLeft, IconPlus, IconSearch, IconX } from "./Icons";
import { PlanRules } from "./PlanRules";

export type SheetNetworkEntry = { id: number; nome: string; bairro: string | null; cidade: string | null; uf: string | null; siglas?: string[] };

/** Dados de um plano para a folha de detalhes (vindos do detalhe da API). */
export type SheetPlan = {
  chave: string;
  operadora: string;
  logoPath: string;
  produto: string;
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
  regras: { tipo: string; texto: string }[];
  rede: { hospitais: SheetNetworkEntry[]; laboratorios: SheetNetworkEntry[] };
};

type Props = {
  plan: SheetPlan;
  uf: string;
  ufNome: string;
  /** Vidas por faixa (mesma ordem de BAND_KEYS). */
  lives: number[];
  total: number | null;
  client: boolean;
  included: boolean;
  /** Ids dos hospitais escolhidos como referência (destaque na rede). */
  refIds: number[];
  onToggle?: () => void;
  onCopy?: () => void;
  onClose: () => void;
};

export function PlanSheet(props: Props) {
  const { plan, uf, ufNome, lives, total, client, included, refIds, onToggle, onCopy, onClose } = props;
  const [view, setView] = useState<"list" | "rede">("list");
  const [netType, setNetType] = useState<"h" | "l">("h");
  const [netCity, setNetCity] = useState<string>("__uf");
  const [netQuery, setNetQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hosp = plan.rede.hospitais.filter((h) => h.uf === uf);
  const labs = plan.rede.laboratorios.filter((l) => l.uf === uf);
  const nh = hosp.length;
  const nl = labs.length;
  const [acomT, acomD] = ACOM_INFO[plan.acomodacao] ?? [plan.acomodacao || "Acomodação não informada", ""];
  const [copT, copD] = copInfo(plan.coparticipacao, plan.coparticipacaoTabela);
  const hasCop = plan.regras.some((r) => r.tipo === "Regras de Coparticipação");
  const sections = useMemo(
    () => [...plan.regras].filter((r) => r.texto).sort((a, b) => a.tipo.localeCompare(b.tipo, "pt")),
    [plan.regras],
  );
  const activeBands = BAND_KEYS.map((_, i) => i).filter((i) => (lives[i] ?? 0) > 0);
  const n = lives.reduce((a, b) => a + b, 0);

  const netRows = useMemo(() => {
    const items = netType === "h" ? hosp : labs;
    const q = normText(netQuery).trim();
    const cities = [...new Set(items.map((x) => x.cidade).filter(Boolean) as string[])];
    const cityOk = (x: SheetNetworkEntry) => netCity === "__uf" || x.cidade === netCity;
    return {
      cities,
      rows: items
        .filter((x) => cityOk(x) && (!q || normText(`${x.nome} ${x.bairro ?? ""} ${x.cidade ?? ""}`).includes(q)))
        .sort((a, b) => Number(refIds.includes(b.id)) - Number(refIds.includes(a.id)) || a.nome.localeCompare(b.nome, "pt")),
    };
  }, [hosp, labs, netType, netCity, netQuery, refIds]);

  function openRede(type: "h" | "l") {
    setNetType(type);
    setNetCity("__uf");
    setView("rede");
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sTitle">
        <div className="pbar">
          <div className="crumb"><b>{plan.operadora}</b> › {plan.tabela} › {ufNome}</div>
          <button type="button" className="x" onClick={onClose} aria-label="Fechar detalhes"><IconX /></button>
        </div>
        <div className="pv">
          <div className="pgrid">
            <div className="phead">
              <div className="ptop">
                <div className="grow">
                  <h2 id="sTitle">{plan.plano}</h2>
                  <div className="sub">{plan.produto}</div>
                  <button type="button" className="lnk" onClick={onClose}><IconLeft />voltar</button>
                </div>
                <span className="plg"><Image src={plan.logoPath} alt={plan.operadora} width={96} height={42} unoptimized /></span>
              </div>
              <div className="hi">
                <div><h4>{acomT}</h4><p>{acomD}</p></div>
                <div>
                  <h4>{copT}</h4>
                  <p>{copD}</p>
                  {hasCop ? (
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        setView("list");
                        requestAnimationFrame(() => {
                          const el = document.getElementById("acc-coparticipacao") as HTMLDetailsElement | null;
                          if (el) {
                            el.open = true;
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        });
                      }}
                    >
                      Ver regras de coparticipação <IconArrow />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="facts">
                <span>Contratação <b>{plan.contratacao}</b></span>
                <span>Reembolso <b>{reembolsoOf(plan.tabela, plan.regras).replace(/^Reembolso /, "").replace(/^Com reembolso.*/, "Sim").replace(/^Sem reembolso/, "Não")}</b></span>
                <span>Vidas <b>{plan.vidasMin} a {plan.vidasMax}</b></span>
                <span>Aceita MEI <b>{plan.aceitaMei ? "Sim" : "Não"}</b></span>
              </div>
            </div>

            <div className="pbody">
              {view === "list" ? (
                <div id="pList">
                  <div className="ltools">
                    <span>{sections.length} seções com as regras da operadora</span>
                    <button
                      type="button"
                      className="lnk"
                      onClick={() => {
                        const next = !allOpen;
                        document.querySelectorAll<HTMLDetailsElement>("#pList details.row").forEach((d) => { d.open = next; });
                        setAllOpen(next);
                      }}
                    >
                      {allOpen ? "Fechar todas" : "Abrir todas"}
                    </button>
                  </div>
                  {sections.map((s) => (
                    <details key={s.tipo} className="row" id={s.tipo === "Regras de Coparticipação" ? "acc-coparticipacao" : undefined}>
                      <summary>{s.tipo}</summary>
                      <div className="in"><PlanRules text={s.texto} plan={plan.plano} /></div>
                    </details>
                  ))}
                </div>
              ) : (
                <div id="pRede">
                  <div className="rhead">
                    <button type="button" className="lnk" onClick={() => setView("list")}><IconLeft />voltar ao plano</button>
                    <h3>{netType === "h" ? "Hospitais" : "Laboratórios"}</h3>
                  </div>
                  <div className="netbar">
                    <div className="search">
                      <IconSearch />
                      <input type="search" placeholder="Filtrar por nome ou bairro" value={netQuery} onChange={(e) => setNetQuery(e.target.value)} />
                    </div>
                    <select aria-label="Tipo de credenciado" value={netType} onChange={(e) => setNetType(e.target.value as "h" | "l")}>
                      <option value="h">Hospitais ({nh})</option>
                      <option value="l">Laboratórios ({nl})</option>
                    </select>
                    <select aria-label="Cidade" value={netCity} onChange={(e) => setNetCity(e.target.value)}>
                      <option value="__uf">Todo o estado ({uf})</option>
                      {netRows.cities.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <span className="cnt">{netRows.rows.length} {netType === "h" ? (netRows.rows.length === 1 ? "hospital" : "hospitais") : netRows.rows.length === 1 ? "laboratório" : "laboratórios"}</span>
                  </div>
                  {netRows.rows.length ? (
                    <div className="scrollx">
                      <table className="dt">
                        <thead>
                          <tr>
                            <th>{netType === "h" ? "Hospital" : "Laboratório"}</th>
                            <th>Bairro</th>
                            <th>Cidade</th>
                            {netType === "h" ? <th>Atendimento</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {netRows.rows.slice(0, 500).map((x) => (
                            <tr key={`${x.id}-${x.nome}`}>
                              <td>{x.nome}{refIds.includes(x.id) ? <span className="tag ok"> Referência</span> : null}</td>
                              <td>{x.bairro ?? ""}</td>
                              <td>{x.cidade}/{x.uf}</td>
                              {netType === "h" ? (
                                <td>{(x.siglas ?? []).map((a) => (<span key={a} className="tag" title={LEGENDA_ATENDIMENTO[a] ?? ""}>{a}</span>))}</td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="note" style={{ padding: 16 }}>Nenhum {netType === "h" ? "hospital" : "laboratório"} para esse filtro.</p>
                  )}
                </div>
              )}
            </div>

            <aside className="pside">
              <div className="pcard">
                <div className="t">{plan.plano}<small>{plan.operadora} · {plan.acomodacao} · {copShort(plan.coparticipacao)}</small></div>
                {activeBands.map((i) => (
                  <div key={BAND_KEYS[i]} className="prow">
                    <span>{faixaLabel(BAND_KEYS[i])}</span>
                    <span><span className="q">{lives[i]} ×</span> {brl(plan.precos[BAND_KEYS[i]])}</span>
                  </div>
                ))}
                <div className="ptot"><span className="c">R$</span><b>{total == null ? "—" : total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span className="m">/mês</span></div>
                <div className="pnote">{n} {n === 1 ? "vida" : "vidas"} · {plan.contratacao}</div>
                {!client && onToggle ? (
                  <div className="pact">
                    <button type="button" id="sInc" className={`bigbtn${included ? " on" : ""}`} aria-pressed={included} onClick={onToggle}>
                      {included ? <><IconCheck /><span>Incluído na proposta</span></> : <><IconPlus /><span>Incluir na proposta</span></>}
                    </button>
                    <button type="button" className="bigbtn ghost" onClick={() => { onCopy?.(); setCopied(true); setTimeout(() => setCopied(false), 2200); }}>
                      <IconCopy /><span>{copied ? "Resumo copiado" : "Copiar resumo"}</span>
                    </button>
                  </div>
                ) : null}
                <details className="allf">
                  <summary><span>Ver todas as faixas etárias</span><span className="pm" /></summary>
                  {BAND_KEYS.map((band) => (
                    <div key={band} className="prow"><span>{faixaLabel(band)}</span><span>{brl(plan.precos[band])}</span></div>
                  ))}
                </details>
              </div>
              <button type="button" className="ncard" disabled={nh === 0} onClick={() => openRede("h")}>
                <div><b>{nh} {nh === 1 ? "Hospital" : "Hospitais"}</b><span>{nh ? `Veja a rede hospitalar em ${uf}.` : "Não informado pela operadora."}</span></div>
                <IconHospital />
              </button>
              <button type="button" className="ncard" disabled={nl === 0} onClick={() => openRede("l")}>
                <div><b>{nl ? nl + " " : ""}{nl === 1 ? "Laboratório" : "Laboratórios"}</b><span>{nl ? `Veja os laboratórios em ${uf}.` : "Não informado pela operadora."}</span></div>
                <IconLab />
              </button>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
