export type ClientQuoteSnapshot = {
  nome: string;
  geradoEm: string;
  uf: string;
  lives: number[];
  plans: {
    chave: string;
    operadora: string;
    logoPath: string;
    plano: string;
    tabela: string;
    acomodacao: string;
    contratacao: string;
    coparticipacao: string;
    total: number;
    regras: { tipo: string; texto: string }[];
    rede: {
      hospitais: { nome: string; cidade: string | null; uf: string | null; siglas: string[] }[];
      laboratorios: { nome: string; cidade: string | null; uf: string | null }[];
    };
  }[];
};

export type ClientQuoteResult =
  | { status: "ok"; snapshot: ClientQuoteSnapshot }
  | { status: "invalid" | "expired"; message: string };
