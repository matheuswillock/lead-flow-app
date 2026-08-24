/**
 * Escapa os metacaracteres de LIKE/ILIKE para que o valor seja comparado
 * literalmente, e não como padrão.
 *
 * O Prisma traduz `{ equals: <valor>, mode: "insensitive" }` para
 * `coluna ILIKE $1` passando o valor CRU — medido com Prisma 6.19.3 contra o
 * Postgres local (`supabase/postgres:17.6.1.149`), sem escape e sem cláusula
 * ESCAPE. Em Postgres `_` casa um caractere qualquer e `%` casa N, então
 * qualquer endereço com `_` vira padrão e casa a linha de outra pessoa:
 *
 *   'mariaXsilva@example.com' ILIKE 'maria_silva@example.com'  -> true
 *   'maria.silva@example.com' ILIKE 'maria_silva@example.com'  -> true
 *   'qualquer@example.com'    ILIKE '%@example.com'            -> true
 *
 * `nome_sobrenome@` vs `nome.sobrenome@` é a colisão mais comum em base
 * importada.
 *
 * O caractere de escape padrão de LIKE/ILIKE em Postgres é a barra invertida —
 * não precisa de cláusula ESCAPE, que o Prisma não emite. Medido pelo próprio
 * Prisma contra linhas reais:
 *
 *   ILIKE 'maria_silva@example.com'  -> maria.silva@, maria_silva@,
 *                                       Maria_Silva@, mariaXsilva@
 *   ILIKE 'maria\_silva@example.com' -> maria_silva@, Maria_Silva@
 *
 * Ou seja: fecha o curinga e preserva a insensibilidade a caixa, que é o que
 * `mode: "insensitive"` deveria significar. Escapar é preferível a comparar
 * variantes literais (`in: [valor, minúsculas]`) porque as colunas de e-mail
 * deste schema NÃO são normalizadas na escrita — `Lead.email`, `Profile.email`
 * e `EmailContact.email` guardam o que veio — então caixa mista arbitrária
 * existe e a comparação precisa continuar ignorando caixa de verdade.
 *
 * Use em toda igualdade case-insensitive sobre valor vindo de fora. NÃO use em
 * busca (`contains`), onde o curinga faz parte da intenção.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}
