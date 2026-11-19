import type { PlanCatalogFile } from "./planCatalogSchema"

/** Base mínima e válida para os testes do importador. Cada teste altera só o que precisa. */
export function planCatalogFixture(): PlanCatalogFile {
  const faixas = ["00-18", "19-23"]
  return {
    sobre: {
      fonte: "teste",
      geradoEm: "2026-11-07T23:11:38.617Z",
      estados: { SP: "São Paulo - SP" },
      faixasEtarias: faixas,
    },
    legendaAtendimento: { H: "Internação Hospitalar", PS: "Pronto Socorro Geral" },
    planos: [
      {
        chave: "abc123",
        estado: "SP",
        cidade: "São Paulo - SP",
        operadora: "SulAmérica",
        produto: "Produto X",
        planoId: 100,
        plano: "Plano X",
        tabela: "Tabela X",
        acomodacao: "Apartamento",
        contratacao: "Livre",
        contratacaoPainel: "Livre",
        coparticipacao: "Sem coparticipação",
        coparticipacaoTabela: "Completa",
        aceitaMei: false,
        remissao: false,
        vidasMin: 2,
        vidasMinPainel: 2,
        vidasMax: 29,
        precos: { "00-18": 100.5, "19-23": 120 },
        regras: { Carências: "txt1" },
      },
    ],
    rede: {
      "100": { hospitais: [[7, "H,PS"]], laboratorios: [7] },
    },
    textos: { txt1: "Carência de 180 dias." },
    credenciados: {
      "7": { nome: "Hospital Sete", bairro: null, cidade: "São Paulo", uf: "SP", regiao: null, endereco: null, site: null },
    },
  }
}
