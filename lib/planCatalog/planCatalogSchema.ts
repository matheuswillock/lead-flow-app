import { z } from "zod";

// Forma do arquivo base-simulador.json gerado pelo painel do corretor.
// Validado na borda: qualquer desvio aborta a importação antes de tocar o banco.

const planSchema = z.object({
  chave: z.string().min(1),
  estado: z.string().length(2),
  cidade: z.string().min(1),
  operadora: z.string().min(1),
  produto: z.string(),
  planoId: z.number().int(),
  plano: z.string(),
  tabela: z.string(),
  acomodacao: z.string(),
  contratacao: z.string(),
  contratacaoPainel: z.string(),
  coparticipacao: z.string(),
  coparticipacaoTabela: z.string(),
  aceitaMei: z.boolean(),
  remissao: z.boolean(),
  vidasMin: z.number().int().min(0),
  vidasMinPainel: z.number().int().min(0),
  vidasMax: z.number().int().min(1),
  precos: z.record(z.string(), z.number().nonnegative()),
  regras: z.record(z.string(), z.string()),
});

const providerSchema = z.object({
  nome: z.string().min(1),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().length(2).nullable(),
  regiao: z.string().nullable(),
  endereco: z.string().nullable(),
  site: z.string().nullable(),
});

const networkSchema = z.object({
  hospitais: z.array(z.tuple([z.number().int(), z.string()])),
  laboratorios: z.array(z.number().int()),
});

export const planCatalogFileSchema = z.object({
  sobre: z.object({
    fonte: z.string(),
    geradoEm: z.string(),
    estados: z.record(z.string(), z.string()),
    faixasEtarias: z.array(z.string()).min(1),
  }),
  legendaAtendimento: z.record(z.string(), z.string()),
  planos: z.array(planSchema).min(1),
  rede: z.record(z.string(), networkSchema),
  textos: z.record(z.string(), z.string()),
  credenciados: z.record(z.string(), providerSchema),
});

export type PlanCatalogFile = z.infer<typeof planCatalogFileSchema>;
