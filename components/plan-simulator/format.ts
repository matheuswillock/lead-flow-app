/** Rótulos e formatação do simulador, iguais aos do protótipo. */

export const FAIXAS = ["00 a 18", "19 a 23", "24 a 28", "29 a 33", "34 a 38", "39 a 43", "44 a 48", "49 a 53", "54 a 58", "59 ou mais"] as const;

export const brl = (v: number | null | undefined): string =>
  v == null ? "—" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ex.: "00-18" -> "00 a 18 anos"; "59-199" -> "59 ou mais". */
export const faixaLabel = (band: string): string => {
  const [min, max] = band.split("-");
  return Number(max) >= 199 ? `${Number(min)} ou mais` : `${min.padStart(2, "0")} a ${max.padStart(2, "0")} anos`;
};

/** Ordem das faixas no painel (00-18 … 59-199). */
export const BAND_KEYS = ["00-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59-199"] as const;

export const copShort = (coparticipacao: string): string => {
  if (/^sem/i.test(coparticipacao)) return "Sem coparticipação";
  if (/parcial/i.test(coparticipacao)) return "Copart. parcial";
  return "Copart. total";
};

export const copChipLabel = (coparticipacao: string): string =>
  /^sem/i.test(coparticipacao) ? "Sem" : /parcial/i.test(coparticipacao) ? "Parcial" : "Total";

/** Reembolso informado pelo nome da tabela, como no protótipo. */
export function reembolsoOf(tabela: string, regras: { tipo: string }[]): string {
  if (/sem reembolso/i.test(tabela)) return "Sem reembolso";
  const m = tabela.match(/reembolso\s+([A-Za-zÀ-ú]+)/i);
  if (m) return "Reembolso " + m[1].toLowerCase();
  return regras.some((r) => r.tipo === "Exemplos de Reembolso") ? "Com reembolso (ver tabela)" : "Não informado";
}

export const ACOM_INFO: Record<string, [string, string]> = {
  Enfermaria: ["Quarto coletivo (enfermaria)", "Na internação, o paciente fica em quarto compartilhado, em geral com 2 a 4 leitos."],
  Apartamento: ["Quarto privativo (apartamento)", "Na internação, o paciente fica em quarto individual, com direito a acompanhante."],
  Ambulatorial: ["Sem internação (ambulatorial)", "Cobre consultas, exames e terapias. Não inclui internação hospitalar."],
};

export function copInfo(coparticipacao: string, copTxt: string): [string, string] {
  if (/^sem/i.test(coparticipacao)) return ["Sem coparticipação", "Não há cobrança extra ao usar o plano. O custo é só a mensalidade."];
  if (/parcial/i.test(coparticipacao)) return ["Coparticipação parcial", "Cobrança extra só em alguns atendimentos, como consultas e exames simples, conforme as regras da operadora."];
  const pc = (copTxt.match(/\d+\s*%/) ?? [])[0];
  return ["Coparticipação total" + (pc ? ` (${pc.replace(/\s/g, "")})` : ""), "Uma parte do valor de consultas, exames e terapias é paga a cada uso, conforme as regras da operadora."];
}

export const LEGENDA_ATENDIMENTO: Record<string, string> = {
  H: "Internação Hospitalar",
  M: "Maternidade",
  PS: "Pronto Socorro Geral",
  PSP: "Pronto Socorro Infantil E/Ou Pediatrico.",
  "H¹": "Internação Com Especialidade E/Ou Publico Alvo Diferenciado, Verifique Junto a Operadora.",
  PA: "Pronto Atendimento",
  "PS¹": "Pronto Socorro Com Especialidade E/Ou Publico Alvo Diferenciado, Verifique Junto a Operadora.",
  PSA: "Pronto Socorro Adulto",
  "PA*": "Pronto Atendimento Com Atendimento em Horário Diferenciado, Verificar Junto a Operadora.",
  "PS*": "Pronto Socorro Com Atendimento em Horário Diferenciado, Verificar Junto a Operadora.",
  "PA¹": "Pronto Atendimento Com Especialidade E/Ou Publico Alvo Diferenciado, Verifique Junto a Operadora.",
  "AMB¹": "Ambulatório Com Especialidade E/Ou Publico Alvo Diferenciado, Verifique Junto a Operadora.",
  AMB: "Ambulatório",
};
