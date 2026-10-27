import { Prisma } from "@prisma/client";

export const OPEN_LEAD_EMAIL_DUPLICATE_MESSAGE =
  "Já existe outro lead ativo com este e-mail neste time. Conclua ou finalize o outro lead antes de reabrir este.";
export const OPEN_LEAD_CNPJ_DUPLICATE_MESSAGE =
  "Já existe outro lead ativo com este CNPJ neste time. Conclua ou finalize o outro lead antes de reabrir este.";

function targetMentions(target: unknown, field: "email" | "cnpj"): boolean {
  if (Array.isArray(target)) return target.some((part) => String(part).toLowerCase().includes(field));
  return typeof target === "string" && target.toLowerCase().includes(field);
}

/**
 * SPEC 11, D41: os índices únicos de e-mail e CNPJ valem só entre leads "em aberto" (nova oportunidade,
 * agendado ou sem status). Reabrir um lead antigo enquanto outro lead ativo tem o mesmo contato viola o
 * índice (P2002). Devolve a mensagem para o usuário, ou `null` quando o erro não é essa violação.
 * `meta.target` pode ser a lista de colunas ou o nome do índice parcial; os dois casos são tratados.
 */
export function describeOpenLeadDuplicateError(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const target = error.meta?.target;
  if (targetMentions(target, "cnpj")) return OPEN_LEAD_CNPJ_DUPLICATE_MESSAGE;
  if (targetMentions(target, "email")) return OPEN_LEAD_EMAIL_DUPLICATE_MESSAGE;
  return null;
}
