import type { PlanCatalogFile } from "./planCatalogSchema";

export type NetworkKind = "HOSPITAL" | "LAB";

export type PlanTableRow = {
  chave: string;
  estado: string;
  cidade: string;
  operatorName: string;
  produto: string;
  planoId: number;
  plano: string;
  tabela: string;
  acomodacao: string;
  contratacao: string;
  contratacaoPainel: string;
  coparticipacao: string;
  coparticipacaoTabela: string;
  aceitaMei: boolean;
  remissao: boolean;
  vidasMin: number;
  vidasMinPainel: number;
  vidasMax: number;
  precos: Record<string, number>;
  regras: Record<string, string>;
};

export type PlanCatalogRows = {
  operators: { name: string; logoPath: string }[];
  tables: PlanTableRow[];
  ruleTexts: { id: string; texto: string }[];
  providers: { id: number; nome: string; bairro: string | null; cidade: string | null; uf: string | null; regiao: string | null; endereco: string | null; site: string | null }[];
  networkEntries: { planoId: number; providerId: number; kind: NetworkKind; atendimento: string[] }[];
};

export type PlanCatalogTransformResult = {
  rows: PlanCatalogRows;
  issues: string[];
};

/** Caminho público do logo da operadora. Ex.: "SulAmérica" -> "/operadoras/sulamerica.svg". */
export function planOperatorLogoPath(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `/operadoras/${slug}.svg`;
}

/**
 * Converte o arquivo validado em linhas prontas para o repositório e lista
 * todas as inconsistências. A importação só grava se `issues` estiver vazio.
 */
export function transformPlanCatalog(file: PlanCatalogFile): PlanCatalogTransformResult {
  const issues: string[] = [];
  const faixas = file.sobre.faixasEtarias;
  const estados = new Set(Object.keys(file.sobre.estados));
  const textoIds = new Set(Object.keys(file.textos));
  const providerIds = new Set(Object.keys(file.credenciados));
  const siglas = new Set(Object.keys(file.legendaAtendimento));
  const planoIds = new Set<number>();
  const chaves = new Set<string>();

  const operatorNames = new Set<string>();
  const tables: PlanTableRow[] = [];

  for (const plano of file.planos) {
    if (chaves.has(plano.chave)) issues.push(`chave duplicada: ${plano.chave}`);
    chaves.add(plano.chave);
    planoIds.add(plano.planoId);
    operatorNames.add(plano.operadora);

    if (!estados.has(plano.estado)) issues.push(`estado sem cadastro em sobre.estados: ${plano.estado} (chave ${plano.chave})`);

    const faixasDoPlano = Object.keys(plano.precos);
    for (const faixa of faixas) {
      if (!(faixa in plano.precos)) issues.push(`preço sem faixa ${faixa} (chave ${plano.chave})`);
    }
    for (const faixa of faixasDoPlano) {
      if (!faixas.includes(faixa)) issues.push(`faixa desconhecida ${faixa} (chave ${plano.chave})`);
    }

    for (const [tipo, textoId] of Object.entries(plano.regras)) {
      if (!textoIds.has(textoId)) issues.push(`regra "${tipo}" aponta para texto inexistente ${textoId} (chave ${plano.chave})`);
    }

    tables.push({
      chave: plano.chave,
      estado: plano.estado,
      cidade: plano.cidade,
      operatorName: plano.operadora,
      produto: plano.produto,
      planoId: plano.planoId,
      plano: plano.plano,
      tabela: plano.tabela,
      acomodacao: plano.acomodacao,
      contratacao: plano.contratacao,
      contratacaoPainel: plano.contratacaoPainel,
      coparticipacao: plano.coparticipacao,
      coparticipacaoTabela: plano.coparticipacaoTabela,
      aceitaMei: plano.aceitaMei,
      remissao: plano.remissao,
      vidasMin: plano.vidasMin,
      vidasMinPainel: plano.vidasMinPainel,
      vidasMax: plano.vidasMax,
      precos: plano.precos,
      regras: plano.regras,
    });
  }

  const networkEntries: PlanCatalogRows["networkEntries"] = [];
  for (const [planoIdKey, rede] of Object.entries(file.rede)) {
    const planoId = Number(planoIdKey);
    if (!planoIds.has(planoId)) issues.push(`rede de planoId sem tabela: ${planoIdKey}`);

    for (const [providerId, atendimentoRaw] of rede.hospitais) {
      if (!providerIds.has(String(providerId))) issues.push(`hospital sem credenciado ${providerId} (planoId ${planoIdKey})`);
      const codes = atendimentoRaw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const code of codes) {
        if (!siglas.has(code)) issues.push(`sigla de atendimento desconhecida ${code} (planoId ${planoIdKey})`);
      }
      networkEntries.push({ planoId, providerId, kind: "HOSPITAL", atendimento: codes });
    }

    for (const providerId of rede.laboratorios) {
      if (!providerIds.has(String(providerId))) issues.push(`laboratório sem credenciado ${providerId} (planoId ${planoIdKey})`);
      networkEntries.push({ planoId, providerId, kind: "LAB", atendimento: [] });
    }
  }

  const providers = Object.entries(file.credenciados).map(([id, c]) => ({
    id: Number(id),
    nome: c.nome,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
    regiao: c.regiao,
    endereco: c.endereco,
    site: c.site,
  }));

  const operators = [...operatorNames].sort().map((name) => ({ name, logoPath: planOperatorLogoPath(name) }));
  const ruleTexts = Object.entries(file.textos).map(([id, texto]) => ({ id, texto }));

  return { rows: { operators, tables, ruleTexts, providers, networkEntries }, issues };
}
