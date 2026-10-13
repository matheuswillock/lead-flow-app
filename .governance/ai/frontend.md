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
