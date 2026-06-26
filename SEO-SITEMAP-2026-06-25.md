# Relatorio de Otimizacao do Sitemap XML — Corretor Studio

**Data:** 2026-06-25
**URL do sitemap atual:** https://www.corretorstudio.com/sitemap.xml
**Arquivo fonte:** `app/sitemap.ts` (Next.js App Router)

---

## 1. Analise do Sitemap Atual

### 1.1 Estrutura geral

O sitemap atual contem 12 URLs geradas dinamicamente pelo Next.js App Router via `app/sitemap.ts`. A geracao usa `getPublicResourceSlugs()` para listar as paginas de recursos e adiciona rotas base manualmente.

### 1.2 Problemas identificados

| # | Problema | Severidade | Detalhes |
|---|---------|-----------|---------|
| 1 | **`lastmod` identico em todas as URLs** | Alta | Todas as 12 URLs possuem `lastmod: 2026-06-23T14:54:41.089Z`. O valor e definido como `const now = new Date()` no momento do build, o que faz todas as datas serem identicas. Isso reduz a utilidade do campo para crawlers — o Google tende a ignorar `lastmod` quando o valor nao reflete alteracoes reais. |
| 2 | **`/llms.txt` incluido no sitemap** | Media | O arquivo `llms.txt` e um recurso machine-readable (protocolo llms.txt), nao uma pagina HTML navegavel. Nao deve estar no sitemap XML, pois crawlers esperam paginas indexaveis. |
| 3 | **Pagina `/subscribe` ausente** | Media | A pagina de assinatura existe no site em producao e possui componentes no projeto (`app/subscribe/features/components/StepIndicator.tsx`), mas nao esta incluida no sitemap. Como pagina de conversao, tem importancia comercial alta. |
| 4 | **`changefreq` uniforme para recursos** | Baixa | Todas as paginas de `/recursos/*` usam `changefreq: weekly`, mas o conteudo dessas paginas e predominantemente estatico (as entradas em `publicResources.ts` possuem `publishedTime` e `modifiedTime` fixos em `2026-04-10`). O valor `monthly` seria mais preciso. |
| 5 | **Ausencia de sitemap index** | Baixa | Com apenas 12 URLs nao ha necessidade tecnica imediata, mas um sitemap index (`sitemapindex`) facilita a organizacao futura quando o site crescer (blog, novas paginas de recursos, paginas programaticas). |
| 6 | **Prioridade uniforme nos recursos** | Baixa | Todas as 6 paginas de `/recursos/*` possuem `priority: 0.8`. Paginas com intencao de conversao direta (ex.: `crm-corretores-saude`, `crm-vs-planilha`) poderiam ter prioridade ligeiramente maior que paginas informativas (ex.: `faq-corretor-studio`). |
| 7 | **URL base sem `www`** | Info | O `DEFAULT_SITE_URL` em `lib/metadata/share.ts` e `https://corretorstudio.com` (sem www), mas o sitemap em producao gera URLs com `www`. Isso depende da variavel de ambiente `NEXT_PUBLIC_APP_URL` estar configurada com `www` no deploy. Nao e um problema ativo, mas vale monitorar consistencia. |

### 1.3 Paginas ausentes no sitemap

| Pagina | Existe no site? | Deve entrar no sitemap? | Motivo |
|--------|----------------|------------------------|--------|
| `/subscribe` | Sim (acessivel em producao) | Sim | Pagina de conversao/assinatura — alta importancia comercial |
| `/llms.txt` | Sim (recurso de arquivo) | Nao | Nao e pagina HTML indexavel |

---

## 2. Sitemap Otimizado

### 2.1 XML pronto para substituicao

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Homepage — pagina principal, maior prioridade -->
  <url>
    <loc>https://www.corretorstudio.com/</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Pagina de assinatura/conversao — alta prioridade comercial -->
  <url>
    <loc>https://www.corretorstudio.com/subscribe</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Hub de recursos — agrega todas as paginas de conteudo SEO -->
  <url>
    <loc>https://www.corretorstudio.com/recursos</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>

  <!-- Recursos com intencao de conversao alta -->
  <url>
    <loc>https://www.corretorstudio.com/recursos/crm-corretores-saude</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/recursos/crm-vs-planilha</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/recursos/pipeline-planos-saude</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Recursos com intencao informacional -->
  <url>
    <loc>https://www.corretorstudio.com/recursos/gestao-equipe-comercial</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/recursos/integracoes-corretor-studio</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/recursos/faq-corretor-studio</loc>
    <lastmod>2026-04-10T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- Paginas legais — baixa prioridade, raramente mudam -->
  <url>
    <loc>https://www.corretorstudio.com/privacy-policy</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/terms</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <url>
    <loc>https://www.corretorstudio.com/cookies</loc>
    <lastmod>2026-06-25T00:00:00.000Z</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

</urlset>
```

### 2.2 Resumo das alteracoes

| Alteracao | Antes | Depois |
|-----------|-------|--------|
| Total de URLs | 12 | 12 (removeu 1, adicionou 1) |
| `/llms.txt` | Incluido (priority 0.6) | Removido |
| `/subscribe` | Ausente | Adicionado (priority 0.9) |
| `lastmod` | Identico em todas (timestamp do build) | Diferenciado por pagina usando `modifiedTime` real dos recursos |
| `changefreq` dos recursos | `weekly` | `monthly` (reflete frequencia real de atualizacao) |
| `changefreq` das paginas legais | `monthly` | `yearly` |
| Prioridade das paginas legais | 0.4 | 0.3 |
| Prioridade do FAQ | 0.8 | 0.6 |
| Prioridade de gestao/integracoes | 0.8 | 0.7 |

---

## 3. Recomendacoes de Implementacao

### 3.1 Correcao do `lastmod` dinamico

O problema principal e a linha `const now = new Date()` no topo do arquivo. Essa abordagem gera uma data unica (momento do build) para todas as URLs.

**Solucao recomendada:** usar `modifiedTime` de cada `PublicResourceEntry` e datas explicitas para rotas estaticas.

```typescript
// app/sitemap.ts — versao otimizada
import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import {
  getPublicResourcePath,
  PUBLIC_RESOURCE_ENTRIES,
  PUBLIC_RESOURCES_HUB_PATH,
} from "@/lib/seo/publicResources"

export default function sitemap(): MetadataRoute.Sitemap {
  // Para paginas sem data explicita de modificacao, usar a data do ultimo deploy
  // Idealmente, usar git last-modified ou data fixa atualizada manualmente
  const deployDate = new Date().toISOString()

  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/"),
      lastModified: deployDate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/subscribe"),
      lastModified: deployDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl(PUBLIC_RESOURCES_HUB_PATH),
      lastModified: deployDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: getAbsoluteUrl("/privacy-policy"),
      lastModified: deployDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/terms"),
      lastModified: deployDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/cookies"),
      lastModified: deployDate,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]

  // Usar modifiedTime real de cada recurso
  const resourceRoutes: MetadataRoute.Sitemap = PUBLIC_RESOURCE_ENTRIES.map((entry) => ({
    url: getAbsoluteUrl(getPublicResourcePath(entry.slug)),
    lastModified: entry.modifiedTime,
    changeFrequency: "monthly" as const,
    priority: getResourcePriority(entry.slug),
  }))

  return [...baseRoutes, ...resourceRoutes]
}

function getResourcePriority(slug: string): number {
  // Paginas com intencao de conversao direta
  const highPriority = ["crm-corretores-saude", "crm-vs-planilha", "pipeline-planos-saude"]
  // Paginas informacionais
  const lowPriority = ["faq-corretor-studio"]

  if (highPriority.includes(slug)) return 0.8
  if (lowPriority.includes(slug)) return 0.6
  return 0.7
}
```

### 3.2 `lastmod` baseado em datas reais (abordagem avancada)

Para que o `lastmod` reflita alteracoes reais de conteudo:

1. **Manter `modifiedTime` atualizado em `publicResources.ts`:** sempre que o conteudo de uma pagina de recurso for editado, atualizar o campo `modifiedTime` da entrada correspondente. Isso ja existe na estrutura mas todos os valores estao fixos em `2026-04-10`.

2. **Para paginas estaticas (home, legal, subscribe):** considerar usar uma constante atualizada manualmente ou extrair a data do ultimo commit git do arquivo correspondente via script de build:

```typescript
// Exemplo: extrair lastmod via git (executar no build)
// scripts/generate-lastmod.ts
import { execSync } from "child_process"

export function getGitLastModified(filePath: string): string {
  try {
    const result = execSync(
      `git log -1 --format=%cI -- "${filePath}"`,
      { encoding: "utf-8" }
    ).trim()
    return result || new Date().toISOString()
  } catch {
    return new Date().toISOString()
  }
}
```

### 3.3 Sitemap Index para crescimento futuro

Atualmente, com 12 URLs, um sitemap index nao e necessario. Porem, se o site expandir para incluir blog, casos de uso, ou paginas programaticas (ex.: `/recursos/[slug]` com dezenas de entradas), considerar a seguinte estrutura:

```typescript
// app/sitemap.ts — usando generateSitemaps() do Next.js
export async function generateSitemaps() {
  return [
    { id: "main" },      // paginas principais
    { id: "recursos" },  // paginas de recursos
    { id: "legal" },     // paginas legais
    // { id: "blog" },   // futuro
  ]
}

export default function sitemap({ id }: { id: string }): MetadataRoute.Sitemap {
  switch (id) {
    case "main":
      return [/* homepage, subscribe */]
    case "recursos":
      return [/* hub + todas as paginas de recurso */]
    case "legal":
      return [/* privacy, terms, cookies */]
    default:
      return []
  }
}
```

O Next.js App Router gera automaticamente um sitemap index em `/sitemap.xml` que referencia `/sitemap/main.xml`, `/sitemap/recursos.xml`, etc.

**Recomendacao:** implementar sitemap index somente quando o total de URLs ultrapassar 50, ou quando houver categorias semanticamente distintas (ex.: blog + recursos + produto).

### 3.4 Boas praticas do Next.js App Router para sitemaps

1. **Preferir `app/sitemap.ts` sobre `next-sitemap`:** o projeto ja usa a abordagem nativa do App Router, que e mais simples e nao exige dependencias externas. Manter essa abordagem.

2. **ISR/Static generation:** como o sitemap e gerado estaticamente no build, as datas refletem o momento do deploy. Para sites com conteudo dinamico (ex.: blog com CMS), considerar `export const dynamic = "force-dynamic"` ou `export const revalidate = 3600` para regenerar o sitemap periodicamente.

3. **Nao incluir `llms.txt` ou arquivos de recurso:** apenas paginas HTML indexaveis devem estar no sitemap. O `llms.txt` pode ser referenciado no `robots.txt` via diretiva customizada, mas nao no sitemap.

4. **Validacao automatica:** adicionar uma checagem no CI/CD para garantir que o sitemap gerado e valido (ver secao 4).

---

## 4. Checklist de Validacao

### 4.1 Validacao tecnica do sitemap

- [ ] **Sintaxe XML:** validar o XML com `xmllint` ou validador online (ex.: https://www.xml-sitemaps.com/validate-xml-sitemap.html)
- [ ] **Schema compliance:** verificar conformidade com o schema `http://www.sitemaps.org/schemas/sitemap/0.9`
- [ ] **URLs acessiveis:** confirmar que todas as URLs no sitemap retornam HTTP 200 (nenhum 404, 301 ou 500)
- [ ] **Consistencia com `robots.txt`:** nenhuma URL no sitemap deve estar bloqueada pelo `robots.txt`. Verificar que `/subscribe` nao esta em nenhuma regra `Disallow` (atualmente nao esta)
- [ ] **`/llms.txt` removido:** confirmar ausencia no sitemap gerado
- [ ] **`/subscribe` presente:** confirmar inclusao no sitemap gerado
- [ ] **`lastmod` diferenciado:** verificar que as datas nao sao identicas em todas as URLs
- [ ] **Encoding UTF-8:** confirmar declaracao `<?xml version="1.0" encoding="UTF-8"?>`

### 4.2 Validacao no Google Search Console

1. Acessar Google Search Console em https://search.google.com/search-console
2. Selecionar a propriedade `www.corretorstudio.com`
3. Navegar para **Sitemaps** no menu lateral
4. Inserir a URL do sitemap: `https://www.corretorstudio.com/sitemap.xml`
5. Clicar em **Enviar**
6. Aguardar processamento (pode levar de minutos a dias)
7. Verificar:
   - Status: "Sucesso" (sem erros)
   - URLs descobertas: devem ser 12
   - URLs indexadas: acompanhar evolucao ao longo de 1-2 semanas

### 4.3 Validacao no Bing Webmaster Tools

1. Acessar https://www.bing.com/webmasters
2. Navegar para **Sitemaps**
3. Submeter `https://www.corretorstudio.com/sitemap.xml`
4. Verificar status de indexacao

### 4.4 Teste local antes do deploy

```bash
# Gerar o build local para verificar o sitemap
bun run build

# O sitemap sera gerado em .next/server/app/sitemap.xml
# Verificar conteudo:
cat .next/server/app/sitemap.xml/route.js
# Ou iniciar o servidor de preview e acessar:
bun run start
# Abrir: http://localhost:3000/sitemap.xml
```

### 4.5 Monitoramento continuo

- [ ] Configurar alerta no Google Search Console para erros de sitemap
- [ ] Verificar semanalmente a cobertura de indexacao (URLs indexadas vs. descobertas)
- [ ] Ao adicionar novas paginas publicas, atualizar `app/sitemap.ts` e `publicResources.ts`
- [ ] Ao modificar conteudo de recursos, atualizar `modifiedTime` na entrada correspondente

---

## Apendice: Diferencas entre sitemap atual e otimizado

```diff
  URLs no sitemap:
  [=] https://www.corretorstudio.com/                          (priority 1.0 → 1.0)
+ [+] https://www.corretorstudio.com/subscribe                 (priority 0.9) — ADICIONADA
  [=] https://www.corretorstudio.com/recursos                  (priority 0.85 → 0.85)
  [=] https://www.corretorstudio.com/recursos/crm-corretores-saude     (priority 0.8 → 0.8)
  [~] https://www.corretorstudio.com/recursos/crm-vs-planilha         (priority 0.8 → 0.8)
  [~] https://www.corretorstudio.com/recursos/pipeline-planos-saude   (priority 0.8 → 0.8)
  [~] https://www.corretorstudio.com/recursos/gestao-equipe-comercial  (priority 0.8 → 0.7)
  [~] https://www.corretorstudio.com/recursos/integracoes-corretor-studio (priority 0.8 → 0.7)
  [~] https://www.corretorstudio.com/recursos/faq-corretor-studio      (priority 0.8 → 0.6)
  [~] https://www.corretorstudio.com/privacy-policy            (priority 0.4 → 0.3, yearly)
  [~] https://www.corretorstudio.com/terms                     (priority 0.4 → 0.3, yearly)
  [~] https://www.corretorstudio.com/cookies                   (priority 0.4 → 0.3, yearly)
- [-] https://www.corretorstudio.com/llms.txt                  (priority 0.6) — REMOVIDA
```
