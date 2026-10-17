# Frontend e UI

Leia este arquivo somente para páginas, componentes, formulários, estilos ou interação no navegador.

## Preparação

- Leia `DESIGN.md` e `PRODUCT.md` antes de UI ou copy.
- Use `docs/design/ROTEAMENTO-SKILLS-DESIGN.md` para escolher skills; não escolha por semelhança de descrição.
- Para tela/componente novo, use `corretor-studio-design` e o workflow shadcn antes do JSX.
- Landing pública exige o gate e a aprovação de copy definidos em `docs/design/METODO-LANDING-PAGE.md`.

## Arquitetura

- Fluxos: `page -> context -> service` e `page -> container -> context`.
- Página nova usa `features/context`, `features/services`, `features/container` e `loading.tsx`; pastas opcionais só existem quando usadas.
- Context orquestra estado; Service isola HTTP por interface; Container compõe UI e não chama backend diretamente.
- Effects de leitura são idempotentes, com chave estável, in-flight guard e last-success guard.
- Mutations travam no primeiro clique, desabilitam o trigger e liberam no `finally`.

## Componentes e estilo

- Pesquise, inspecione e instale o componente shadcn com Bun antes de criar markup próprio.
- Formulários usam `FieldGroup` e `Field`; layout usa `gap-*`; dimensões iguais usam `size-*`.
- Use tokens semânticos, `cn()`, Lucide, `Skeleton`, `Badge`, `Separator` e `sonner`.
- Não use cores raw, override manual `dark:`, z-index em overlays, dialogs nativos ou `animate-pulse` artesanal.
- Button icons usam `data-icon`; Avatar tem fallback; Dialog/Sheet/Drawer têm Title.
- Conteúdo de dialog potencialmente longo precisa de altura máxima, corpo rolável e footer fixo.

## Mobile e acesso à API

- UI nova é mobile-first a partir de 360px.
- HTTP no navegador usa `API_CLIENT_BASE` de `@/lib/route-map`, nunca `/api/v1` hardcoded.
- Toda página alterada precisa de spec E2E correspondente com `runResponsiveChecks`, salvo exceção legada já registrada.
- Leia `.governance/ai/testing.md` antes de considerar uma mudança visual concluída.

## Auditoria e validação visual obrigatórias

- Para toda implementação ou alteração visual, execute a skill `impeccable` como auditoria de design; corrija os problemas relevantes e valide as melhorias sem contrariar `DESIGN.md`, `PRODUCT.md`, acessibilidade ou o roteamento de skills do projeto. A auditoria não autoriza substituir tokens, identidade ou decisões de composição do projeto por recomendações genéricas.
- Valide também a interface renderizada com `browser-harness`: abra a página em navegador real, confira a composição e os estados/interações afetados, e inspecione os tamanhos de viewport relevantes (incluindo mobile a partir de 360px e desktop quando aplicável). Corrija regressões e repita a inspeção após as mudanças.
- Combine a inspeção com `design:check` e a cobertura E2E/responsiva exigida. Essas verificações cobrem aspectos diferentes; nenhuma isoladamente comprova a qualidade visual.
- Se `impeccable`, o navegador, o ambiente ou os dados necessários não estiverem disponíveis, registre explicitamente o que não foi verificado e não declare garantia ou validação visual completa.
