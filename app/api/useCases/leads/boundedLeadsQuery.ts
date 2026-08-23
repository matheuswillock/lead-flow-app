/** Acima disso o filtro deixa de ser uma consulta de UI e vira chave patologica. */
const MAX_CUSTOM_FIELD_FILTERS_KEY_LENGTH = 512;

export type BoundedLeadsQueryInput = {
  search: string | null;
  startDate: string | null;
  endDate: string | null;
  limit: number | undefined;
  customFieldFiltersJSON: string;
};

/**
 * Decide se a consulta de leads pertence à fatia cacheável.
 *
 * O board e o calendário mandam sempre o mesmo punhado de combinações — sem
 * busca, sem intervalo de datas e sem `limit` — então colapsam em poucas
 * entradas por time. Já o typeahead de busca (dialog de merge, inbox do
 * WhatsApp) e o `hooks/useLeads` mandam texto livre e instantes ISO com
 * precisão de milissegundo: cachear isso geraria uma entrada por tecla
 * digitada, com hit rate próximo de zero — e na Vercel todo miss é uma
 * escrita no Data Cache.
 *
 * Módulo separado e sem dependências de propósito: é lógica pura e precisa ser
 * testável sem arrastar a cadeia do use case.
 */
export function isBoundedLeadsQuery(input: BoundedLeadsQueryInput): boolean {
  if (input.search) return false;
  if (input.startDate || input.endDate) return false;
  if (input.limit !== undefined) return false;
  if (input.customFieldFiltersJSON.length > MAX_CUSTOM_FIELD_FILTERS_KEY_LENGTH) return false;
  return true;
}
