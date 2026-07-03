# Crítica de Design — Páginas de Conversão (Impeccable · Register Brand)

**Data:** 2026-07-02
**Método:** análise estática de código (somente leitura), sem browser/detector — execução single-context a pedido do solicitante.
**Referências:** `.agents/skills/impeccable/reference/critique.md`, `reference/audit.md`, `reference/brand.md`, `DESIGN.md` (Hybrid Warm-Precision, Poppins+Inter, orange-led).
**Escopo:** `app/page.tsx` (landing) e `app/lead-form/[supabaseId]/page.tsx` (formulário público embedável).

> Contrato de copy verificado: o headline do hero está **intacto** — os três spans de `app/page.tsx:162-176` compõem exatamente "Corretores comuns mandam cotações. Os de ALTA PERFORMANCE usam Corretor Studio." Nenhuma alteração de copy é sugerida neste relatório.

---

## 1. Landing Page (`app/page.tsx` + `components/landing/`)

### Nota: 6,5 / 10

**Primeira impressão.** A página tem espinha dorsal profissional: hero split 7/5 com produto à direita, badge de anúncio, bento assimétrico nas features, seção de captação com prova de confiança. O SEO é exemplar (JSON-LD `@graph` com FAQ, espelhos `sr-only` das seções client-side em `app/page.tsx:267-303`). Porém, a soma de orbs radiais em toda seção, cards com ícone-em-quadradinho-laranja repetidos, barra de métricas genérica e gradiente tricolor no destaque do headline empurra a página na direção do "template de SaaS gerado por IA" — o oposto do posicionamento de ALTA PERFORMANCE que a copy vende. O design aqui é argumento de venda e hoje ele argumenta menos do que a copy.

### O que funciona

- **Motion disciplinado**: `lib/landing/use-landing-motion.ts:26-33` respeita `useReducedMotion` e — decisão excelente — os estados iniciais dos reveals usam `opacity: 1` com offset (`use-landing-motion.ts:35-38`), então nenhuma seção fica invisível se o JS falhar ou o observer não disparar. `viewport: { once: true }` cumpre a política do DESIGN.md ("run once per viewport entry").
- **Bento assimétrico real** em `FeaturesSection.tsx:60-120` (`md:col-span-2` + compactos), alinhado à matriz de influência Zapier/Linear, evitando o grid de cards 100% uniforme.
- **CTA primário com ergonomia Revolut**: `landing-primary-cta` (globals.css:474-478) usa sombra cromática do próprio primary, e o CTA do hero tem `focus:ring-2` explícito (`app/page.tsx:193`).

### Achados

#### P1 — Hierarquia do hero quebrada no mobile por classe inexistente
`app/page.tsx:163` — o primeiro span do h1 usa `text-md`, que **não existe** no Tailwind (o correto seria `text-base`) e não está definida em `globals.css`. Abaixo de 640px o span herda o `text-4xl` do h1 (`app/page.tsx:162`): a linha secundária "Corretores comuns mandam cotações." renderiza a ~36px em `muted-foreground`, **maior** que a linha principal "Os de ALTA PERFORMANCE" (`text-xl` ≈ 20px em `app/page.tsx:166`). A hierarquia do argumento FOMO fica invertida exatamente no primeiro contato mobile.
**Fix:** trocar `text-md` por `text-base`. Uma linha.

#### P1 — Gradiente tricolor no destaque contradiz a estratégia orange-led
`app/globals.css:467-472` (`.landing-primary-gradient`, aplicada em `app/page.tsx:168`) — gradient text com `background-clip: text` indo de `--primary` → `--brand-rose` → `--brand-pink`. Isso acumula três problemas: (a) é ban absoluto do Impeccable (gradient text é o tell nº 1 de página gerada por IA); (b) mesmo sob a exceção do DESIGN.md §4 ("gradient text limitado a palavras destacadas"), o uso de rosa+pink dilui o "warm orange core" e configura o "multi-accent noise" que a Influence Matrix (§2) manda evitar; (c) o destaque recai justamente sobre "ALTA PERFORMANCE", o termo do contrato de copy — ele merece o tratamento mais sólido da página, não o mais frágil (gradiente em texto reduz contraste percebido e falha de formas diferentes por navegador).
**Fix:** manter o destaque com `text-primary` sólido (como já fazem `FeaturesSection.tsx:53`, `HowItWorksSection.tsx:38` e `PricingSection.tsx:97` — que ficariam finalmente consistentes) ou um sublinhado/marker laranja de peso. Não alterar a copy.

#### P1 — Barra de métricas é o template "hero-metric" com números não verificáveis
`components/landing/LogoBar.tsx:3-8` — quatro cards de estatística hardcoded ("500+", "50k+", "+40%", "4.9/5") logo abaixo do hero é exatamente o padrão hero-metric banido pelo Impeccable, e o componente se chama `LogoBar` mas não exibe nenhum logo — a promessa "Confiado por mais de 500 corretores" (`LogoBar.tsx:15`) fica sem lastro visual. "+40% mais conversão" e "4.9/5 avaliação média" sem fonte são passivo de credibilidade (e potencialmente jurídico) numa página cujo público é vendedor profissional — o corretor reconhece social proof vazio de longe.
**Fix:** ou exibir logos/nomes reais de corretoras e operadoras parceiras, ou um depoimento único com nome e foto (a `TestimonialsSection` está comentada em `app/page.tsx:306` — sintoma de que a prova social real ainda não existe). Se as métricas forem reais e auditáveis, mantê-las com fonte; senão, cortar.

#### P1 — Formulário de demo sem associação label/input e sem focus no submit
`components/landing/PricingSection.tsx:158-200` — os três `<label>` não têm `htmlFor` e os `<input>` não têm `id`: screen reader não anuncia o campo (falha WCAG 1.3.1/4.1.2) e clicar no label não foca o input. O botão de submit (`PricingSection.tsx:203-210`) não tem nenhum estilo `focus-visible` (só `hover:`), ao contrário do CTA do hero. Este é o formulário que converte a página inteira.
**Fix:** adicionar `htmlFor`/`id`, `focus-visible:ring-2 focus-visible:ring-ring` no botão. Idealmente migrar para `FieldGroup`+`Field` do shadcn (regra do projeto) — o form atual também não mostra **nenhum** erro inline: o botão só fica desabilitado sem explicar por quê (validação silenciosa; Nielsen #9).

#### P2 — Glassmorphism + combinação border 1px com sombra ≥16px em cards
`app/globals.css:486-516` — `.landing-surface-card`, `-compact`, `-soft` e `-hero-floating` combinam `backdrop-filter: blur(8-12px)` + `border: 1px` + sombras de 16-20px de blur: dois bans do Impeccable juntos (glassmorphism como default e border+sombra grande no mesmo card). O uso vivo hoje é `landing-surface-card-soft` na LogoBar (`LogoBar.tsx:22`) e o `backdrop-blur-xl` do cookie consent (`HomeClientRuntime.tsx:35`). O DESIGN.md §6 pede "border-only depth" em áreas densas e sombra cromática só em CTAs/destaques.
**Fix:** nos stats/cards informativos, ficar com `border + bg-card` simples; reservar blur para o header sticky (uso legítimo, `landingHeader.tsx:9`).

#### P2 — Orbs decorativos em todas as seções com paleta dispersa
`app/globals.css:421-455` — hero (laranja+rose+pink), features (`--chart-1`), email (rose+laranja+pink), how-it-works (`--chart-3` azul), pricing (laranja), footer (laranja). Seis famílias de acento em uma página viola "Uncontrolled multi-accent noise" (DESIGN.md §2) e o mesmo dispositivo decorativo repetido em toda seção vira papel de parede — o equivalente em background dos "eyebrows uppercase repetidos" (o padrão de eyebrow em si **não** ocorre; os pills "Em breve" aparecem 2x, aceitável).
**Fix:** reduzir a 2-3 momentos de orb (hero, spotlight de email, CTA final) e travar a paleta em laranja + um acento de precisão (indigo `--precision-indigo`, que já existe como token e hoje não é usado na landing).

#### P2 — `rounded-3xl` (24px) em cards de conteúdo
`app/page.tsx:242`, `EmailCampaignsSpotlight.tsx:63`, `PricingSection.tsx:155` — radius de 24px em cards é ban do Impeccable e destoa do `--radius: 0.65rem` do sistema. O restante da página usa `rounded-2xl` (16px), criando duas linguagens de raio (anti-pattern "mixed radius language", DESIGN.md §2).
**Fix:** padronizar cards em `rounded-2xl`; deixar 24px+ só para pills.

#### P2 — Cor de marca hardcoded em JSX
`components/landing/landingHeader.tsx:59` — `shadow-[0_8px_18px_-10px_rgba(255,105,0,0.7)]` codifica o laranja na unha (equivale ao hex `#ff6900`), violando a regra "no hardcoded hex in JSX" (DESIGN.md §8). A classe `landing-primary-cta` já resolve isso com `color-mix`.
**Fix:** reutilizar `landing-primary-cta` ou token.

#### P2 — LCP mobile sem `priority` e imagem única em SVG estático
`app/page.tsx:214-220` — a imagem do pipeline visível no mobile (preview compacto) **não** tem `priority`; só a versão desktop tem (`app/page.tsx:249`), que está `hidden` abaixo de `lg` (`app/page.tsx:233`). No mobile, o provável elemento LCP entra sem prioridade de fetch. Além disso, o único artefato de produto da página inteira é `product-banner.svg` repetido 2x — para o register brand ("uma foto decisiva vence cinco medianas"), um único mock estático de baixo detalhe é pouco showcase para um produto cujo argumento é o pipeline.
**Fix:** adicionar `priority` (ou `fetchPriority="high"`) à imagem mobile; médio prazo, screenshot real do Kanban com dados fictícios ricos, estilo Resend "cinematic proof".

#### P2 — Animações em loop infinito sem guarda de reduced-motion
`app/page.tsx:155` (`animate-pulse` no dot do badge) e `app/globals.css:526-528` (`.pulsing-heart` infinita no footer, `LandingFooter.tsx:55`) rodam para sempre e não são cobertas pelo `useReducedMotion` (que só protege os reveals do framer-motion). Não há nenhum bloco `@media (prefers-reduced-motion)` em `globals.css`. Viola DESIGN.md §8 ("respect reduced motion") e §6 ("constant looping gimmicks" a evitar).
**Fix:** `motion-reduce:animate-none` nas duas classes ou media query global.

#### P2 — Tipografia do hero por degraus fixos, sem `clamp()`, com classes mortas
`app/page.tsx:162-176` — o h1 declara `text-4xl…xl:text-7xl` mas todos os três spans internos sobrescrevem o tamanho, tornando a escala do h1 código morto (e a causa raiz do bug do `text-md`). Não há `clamp()` fluido — a escala pula por breakpoint, e o `lg:text-[3.75rem]` arbitrário nunca chega a renderizar. O tracking (`tracking-tight` = -0.025em) está dentro do teto de -0.04em e próximo do spec Display do DESIGN.md §4 — ok.
**Fix:** mover o dimensionamento para os spans com `clamp()` (ex.: `text-[clamp(1.5rem,4vw+0.5rem,3rem)]`) e limpar as classes do h1.

#### P3 — Detalhes de copy e idioma
`EmailCampaignsSpotlight.tsx:70` — "experiencia" sem acento (o `lint:pt-br` deveria acusar). `LandingFooter.tsx:54-56` — "Made with ♥" em inglês numa página 100% PT-BR. `app/page.tsx:180-187` — o subtítulo termina "…indicadores tudo em um só lugar para não ficar para trás" sem pontuação entre "indicadores" e "tudo" (falta travessão ou vírgula).

### Bans do Impeccable — checklist da landing

| Ban | Status |
|---|---|
| Gradient text (`background-clip`) | **VIOLADO** — `landing-primary-gradient` (globals.css:467) |
| Glassmorphism como default | **VIOLADO** (parcial) — família `landing-surface-card*` (globals.css:486-516) |
| Hero-metric template | **VIOLADO** — `LogoBar.tsx:3-8` |
| Border 1px + sombra ≥16px juntos | **VIOLADO** — `landing-surface-card-soft` (globals.css:502-508) |
| Radius 24px+ em cards | **VIOLADO** — 3 ocorrências de `rounded-3xl` |
| Card grids idênticos | OK — bento assimétrico (última fileira de 3 compactos idênticos é aceitável) |
| Eyebrows uppercase repetidos por seção | OK — não há eyebrows uppercase |
| Side-stripe borders | OK |
| Stripes com `repeating-linear-gradient` | OK |
| Ícone arredondado acima de todo heading | **Parcial** — quadrado `bg-primary/15` + ícone laranja se repete em features, how-it-works, spotlight e pricing (grammar de template) |

### Recomendações priorizadas (landing)

1. Corrigir `text-md` → `text-base` (1 linha, resolve o hero mobile).
2. Substituir gradiente tricolor por `text-primary` sólido no "ALTA PERFORMANCE" (consistência + remove o ban + reforça orange-led). Copy intocada.
3. Reconstruir a LogoBar como prova social real (logos ou depoimento com rosto) ou remover até existir.
4. `htmlFor`/`id` + `focus-visible` + erros inline no form de demo (`PricingSection`).
5. Passe de consolidação: raios em `rounded-2xl`, orbs reduzidos a 2-3 e paleta travada em laranja+indigo, `motion-reduce` nos loops, `priority` na imagem mobile.

---

## 2. Formulário Público de Leads (`app/lead-form/[supabaseId]/page.tsx` + `[teamId]/features/`)

### Nota: 6,0 / 10

**Primeira impressão.** Engenharia de formulário acima da média: react-hook-form + zod com `FormMessage` inline, lock de submit em dois níveis, dedup de requests exemplar no hook, estados de erro/sucesso/retry completos. O problema está na **percepção de velocidade** (o gargalo real da rota, dado o p50 de SSR de ~4s) e em acabamento visual: a página é um esqueleto shadcn neutro, sem nenhum traço da marca além do logo — aceitável para embed, mas há gaps concretos de a11y e de loading.

### O que funciona

- **Disciplina de requests exemplar**: `PublicLeadFormHook.ts:34-38, 49-52, 112-120, 176-184` implementa exatamente o padrão do governance (request key estável + in-flight guard + last-success guard) para bootstrap, disponibilidade e slots. Guardas de resposta obsoleta (`!== requestKey`) evitam race conditions.
- **Lock de submit correto**: `PublicLeadForm.tsx:139` (guard de reentrada), `:259-267` (botão desabilitado até o schema validar, com label "Cadastrando..."), `finally` garantido (`:215-217`). Cumpre o Action Button Request Lock à risca.
- **Ciclo completo de estados**: loading (`:292-301`), erro com retry (`:303-317`), sucesso com "Cadastrar outro lead" (`:319-347`). O usuário nunca fica preso (Nielsen #3 e #9 bem servidos).
- **Feedback de campos pendentes orquestrado**: `handleInvalidSubmit` (`:222-245`) foca o primeiro campo pendente e deduplica toasts por hash — nível de cuidado raro em form público.

### Achados

#### P1 — Percepção de velocidade: ~4s de página branca antes de mais um spinner
Com p50 de SSR em ~4s, quem abre o form (especialmente embedado) encara **duas esperas em série**: (1) ~4s de viewport em branco até o HTML chegar — o `loading.tsx` (`app/lead-form/[supabaseId]/loading.tsx`) só cobre navegação client-side dentro do app, não o primeiro hit do iframe/URL direta; (2) chegando o HTML, `bootstrapStatus === "loading"` mostra só um spinner centralizado (`PublicLeadForm.tsx:292-301`) enquanto o cliente busca teamName/planos/SDRs. O `<Suspense>` em `page.tsx:17` é inócuo: envolve componentes client síncronos, então o fallback nunca aparece de forma útil e não há streaming real.
**Fix em duas frentes:** (a) atacar o custo de SSR — a page é praticamente estática (só interpola `supabaseId`), então investigar por que o servidor leva 4s (provável `updateSession` do middleware rodando em rota pública; excluir `/lead-form` do matcher devolveria um TTFB de estático); (b) enquanto isso, trocar os dois spinners por um **skeleton com a silhueta do formulário** (logo + card do time + 2 colunas de campos), que também serve de fallback percebido durante o SSR se a casca vier estática. Governança já exige `Skeleton` em vez de spinner.

#### P1 — Focus invisível no input de convidados extras
`SchedulingSection.tsx:295` — o input de e-mails dentro do chip-container usa `outline-none` e nenhum estilo de foco é aplicado ao wrapper (`:259`): navegação por teclado perde completamente o cursor visual nesse campo (WCAG 2.4.7). O botão de remover chip (`:263-273`) também não tem focus ring próprio.
**Fix:** `focus-within:ring-2 focus-within:ring-ring focus-within:border-ring` no container do chip-input.

#### P2 — Toast de erro disparado por scroll
`PublicLeadForm.tsx:275-290` — ao atingir o fim do form (`useIsInView`) com form sujo e inválido, um toast de erro dispara automaticamente. Usuário que rola para conferir o que falta ganha uma bronca antes de tentar submeter — feedback punitivo em momento neutro (viola "errors displayed near the source" e cria vale emocional). O hash-dedup evita spam, mas não o sobressalto.
**Fix:** trocar o toast-por-scroll por um resumo estático de pendências acima do botão (ex.: "Faltam: Nome, Telefone"), reservando o toast para a tentativa real de submit.

#### P2 — Cor hardcoded no estado de sucesso e cartões sem token semântico
`PublicLeadForm.tsx:335` — `CheckCircle2` com `text-green-500` (raw Tailwind) em vez de `text-semantic-success`; num embed com tema dark do host, o verde-500 não acompanha a paleta. Mesmo arquivo, `:365` usa `bg-muted/30` correto — a inconsistência é pontual.
**Fix:** `text-[var(--semantic-success)]` ou classe semântica equivalente.

#### P2 — Layout do form com `space-y-*` e sem `FieldGroup`/`Field`
`PublicLeadForm.tsx:351, 377-380, 447, 461` — todo o empilhamento usa `space-y-6`/`space-y-4` com `div` cru, contra as regras do projeto (usar `gap-*` e `FieldGroup`+`Field` para forms). Não é bug visual hoje, mas é dívida de consistência com o restante do produto (o grid interno `:409` já usa `gap-4`, correto).
**Fix:** migrar para `FieldGroup`/`Field` na próxima manutenção da rota.

#### P2 — Identidade visual mínima num contexto onde a marca é o fiador
A página inteira usa `rounded-lg border` neutro (`PublicLeadForm.tsx:306, 334, 365, 379`) sem nenhum token de marca — nem o laranja primário aparece fora do botão. Para um form embedado em site de terceiro, o header "Corretor Studio" + card "Este lead será adicionado ao time X" (`:364-369`) cumprem o mínimo de confiança, mas um fio de identidade (borda superior `--primary`, botão com a sombra cromática do CTA da landing) reforçaria o fiador sem brigar com o host. Em contrapartida, a neutralidade garante contraste ok em qualquer host, já que `bg-background` é opaco — decisão defensável, registro como oportunidade e não como erro.

#### P3 — Título "Estudo Plano de Saúde" duplicado como string mágica
`PublicLeadForm.tsx:170` e `SchedulingSection.tsx:114` montam o mesmo template de título em dois lugares; divergência futura é questão de tempo. Extrair constante.

#### P3 — `loading.tsx` com spinner `Loader2` manual
`app/lead-form/[supabaseId]/loading.tsx:7` usa `animate-spin` em vez do componente `Spinner`/`Skeleton` padronizado (o form já usa `Spinner` em `PublicLeadForm.tsx:296`). Unificar quando o skeleton do P1 for construído.

### Recomendações priorizadas (lead-form)

1. Diagnosticar o SSR de 4s (middleware/`updateSession` em rota pública é o primeiro suspeito) e servir casca estática.
2. Skeleton com formato do formulário substituindo os dois spinners (route-level e bootstrap).
3. `focus-within` ring no chip-input de convidados e focus ring nos botões de remover chip.
4. Trocar toast-por-scroll por resumo de pendências inline.
5. Token semântico no check de sucesso; migração `FieldGroup`/`Field` como dívida registrada.

---

## Síntese

| Rota | Nota | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| Landing (`app/page.tsx`) | 6,5/10 | 0 | 4 | 6 | 1 |
| Lead-form (`app/lead-form/[supabaseId]`) | 6,0/10 | 0 | 2 | 4 | 2 |

Nenhum P0 (nada impede a conversão hoje). O tema comum: **a engenharia está acima do design** — as duas rotas têm fundações sólidas (SEO, motion a11y, request discipline, estados) traídas por acabamento visual que ora cai em template de IA (landing), ora abre mão da marca e da percepção de velocidade (lead-form). O contrato de copy do hero está íntegro e nenhuma recomendação o altera; as mudanças propostas (destaque sólido laranja, prova social real) **amplificam** o posicionamento FOMO/alta performance em vez de diluí-lo.
