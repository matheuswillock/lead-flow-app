# Auditoria de Schema.org (Dados Estruturados) -- Corretor Studio

**Data:** 2026-06-25
**Dominio:** https://www.corretorstudio.com
**Paginas auditadas:** 12 (sitemap completo)
**Formato verificado:** JSON-LD (`<script type="application/ld+json">`)

---

## 1. Estado Atual -- Inventario por Pagina

| # | Pagina | Schemas Encontrados | Status |
|---|--------|-------------------|--------|
| 1 | `/` (homepage) | Nenhum | CRITICO |
| 2 | `/privacy-policy` | Nenhum | ALERTA |
| 3 | `/terms` | Nenhum | ALERTA |
| 4 | `/cookies` | Nenhum | ALERTA |
| 5 | `/recursos` | CollectionPage + ItemList | OK |
| 6 | `/llms.txt` | N/A (arquivo texto) | N/A |
| 7 | `/recursos/crm-corretores-saude` | BreadcrumbList + FAQPage | OK |
| 8 | `/recursos/pipeline-planos-saude` | BreadcrumbList + FAQPage | OK |
| 9 | `/recursos/gestao-equipe-comercial` | BreadcrumbList + FAQPage | OK |
| 10 | `/recursos/integracoes-corretor-studio` | BreadcrumbList + FAQPage | OK |
| 11 | `/recursos/faq-corretor-studio` | BreadcrumbList + FAQPage | OK |
| 12 | `/recursos/crm-vs-planilha` | BreadcrumbList + FAQPage | OK |

**Resumo:** 5 de 11 paginas HTML possuem schema. A homepage (pagina mais importante) tem ZERO marcacao estruturada.

---

## 2. Resultados de Validacao -- Schemas Existentes

### 2.1 CollectionPage + ItemList (`/recursos`)

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Recursos Corretor Studio",
  "description": "Central de conteudo sobre CRM, pipeline, gestao de equipe e integracoes para corretores de planos de saude.",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "CRM para corretores de saude", "url": "..." },
      { "@type": "ListItem", "position": 2, "name": "pipeline comercial de planos de saude", "url": "..." },
      { "@type": "ListItem", "position": 3, "name": "gestao de equipe comercial para corretoras", "url": "..." },
      { "@type": "ListItem", "position": 4, "name": "integracoes para corretoras de saude", "url": "..." },
      { "@type": "ListItem", "position": 5, "name": "faq corretor studio", "url": "..." },
      { "@type": "ListItem", "position": 6, "name": "crm vs planilha para corretoras de saude", "url": "..." }
    ]
  }
}
```

| Verificacao | Resultado | Observacao |
|-------------|-----------|------------|
| `@context` presente | OK | |
| `@type` valido | OK | CollectionPage e tipo valido |
| URLs absolutas | OK | Todas usam `https://www.corretorstudio.com/...` |
| Posicoes sequenciais | OK | 1 a 6 corretas |
| Falta `@context` no `mainEntity` | INFO | Aceitavel pois herda do pai, mas recomendavel adicionar |
| Falta `url` no CollectionPage | ALERTA | Recomendado adicionar `"url": "https://www.corretorstudio.com/recursos"` |

### 2.2 BreadcrumbList (paginas `/recursos/*`)

Exemplo (`/recursos/crm-corretores-saude`):

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.corretorstudio.com/" },
    { "@type": "ListItem", "position": 2, "name": "Recursos", "item": "https://www.corretorstudio.com/recursos" },
    { "@type": "ListItem", "position": 3, "name": "CRM para corretores de saude", "item": "https://www.corretorstudio.com/recursos/crm-corretores-saude" }
  ]
}
```

| Verificacao | Resultado | Observacao |
|-------------|-----------|------------|
| `@context` presente | OK | |
| `@type` valido | OK | BreadcrumbList e tipo ativo para rich results |
| Posicoes sequenciais | OK | 1-2-3 em todas as paginas |
| URLs absolutas | OK | |
| Consistencia entre paginas | OK | Mesmo padrao em todas as 6 subpaginas |
| Ultimo item nao deveria ter `item` | ALERTA | Google recomenda omitir a URL do item atual (ultimo breadcrumb) |

### 2.3 FAQPage (paginas `/recursos/*`)

Exemplo (`/recursos/crm-corretores-saude`):

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Qual a vantagem de usar um CRM especifico para corretor de saude?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A vantagem e organizar o processo comercial com linguagem, etapas e indicadores aderentes a rotina de venda de planos."
      }
    }
  ]
}
```

| Verificacao | Resultado | Observacao |
|-------------|-----------|------------|
| `@context` presente | OK | |
| `@type` valido | OK | FAQPage permanece valido |
| Propriedades obrigatorias | OK | `mainEntity`, `Question`, `acceptedAnswer`, `text` |
| Rich results no Google | DESCONTINUADO | Google retirou FAQ rich results em 07/05/2026 |
| Valor para AI/LLM | MANTER | Schema FAQPage continua util para citacoes em AI Overviews, ChatGPT, Perplexity |
| Acentuacao ausente no texto | ALERTA | Respostas sem acentos (ex: "e" ao inves de "e", "nao" ao inves de "nao"). Impacta legibilidade para humanos e LLMs |
| Quantidade de perguntas | INFO | 3-4 perguntas por pagina -- aceitavel, poderia expandir |

### 2.4 Resumo de Problemas nos Schemas Existentes

| Severidade | Problema | Paginas Afetadas | Acao |
|------------|---------|-------------------|------|
| ALERTA | Ultimo ListItem do BreadcrumbList inclui `item` (URL) -- Google recomenda omitir no item atual | 6 paginas `/recursos/*` | Remover `item` do ultimo ListItem |
| ALERTA | CollectionPage sem propriedade `url` | `/recursos` | Adicionar `"url"` |
| ALERTA | Textos das respostas FAQ sem acentuacao portuguesa | 6 paginas `/recursos/*` | Corrigir acentuacao |
| INFO | FAQPage nao gera mais rich results | 6 paginas `/recursos/*` | Manter para AI -- nao remover |

---

## 3. Schemas Ausentes -- O Que Deveria Existir

### 3.1 Homepage (`/`)

A homepage e a pagina mais importante para SEO e nao possui NENHUM schema. Isso e critico.

| Schema Recomendado | Prioridade | Justificativa |
|-------------------|-----------|---------------|
| **Organization** | CRITICA | Identidade da marca para Knowledge Panel do Google e citacoes AI |
| **WebSite** + SearchAction | CRITICA | Habilita sitelinks search box no Google |
| **SoftwareApplication** | ALTA | Classificacao como produto SaaS, elegivel para rich results de software |
| **BreadcrumbList** | MEDIA | Consistencia com demais paginas |

### 3.2 Paginas Legais (`/privacy-policy`, `/terms`, `/cookies`)

| Schema Recomendado | Prioridade | Justificativa |
|-------------------|-----------|---------------|
| **WebPage** | MEDIA | Identificacao basica do tipo de pagina |
| **BreadcrumbList** | MEDIA | Consistencia de navegacao estruturada |

### 3.3 Pagina Indice de Recursos (`/recursos`)

| Schema Recomendado | Prioridade | Justificativa |
|-------------------|-----------|---------------|
| **BreadcrumbList** | MEDIA | Unica pagina de recursos sem breadcrumb |

### 3.4 Paginas de Recursos (`/recursos/*`)

| Schema Recomendado | Prioridade | Justificativa |
|-------------------|-----------|---------------|
| **Article** ou **WebPage** | MEDIA | Complementar BreadcrumbList+FAQPage existentes com tipo de pagina |

---

## 4. Schemas Recomendados -- Codigo JSON-LD Pronto para Implementar

### 4.1 Organization (adicionar na homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Corretor Studio",
  "url": "https://www.corretorstudio.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://www.corretorstudio.com/corretor-studio-share-v1.png",
    "width": 1200,
    "height": 630
  },
  "description": "CRM para corretores de saude. Pipeline Kanban, gestao de equipe, agenda e metricas para aumentar conversao.",
  "foundingDate": "2024",
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "suporte@corretorstudio.com",
    "contactType": "customer support",
    "availableLanguage": "Portuguese"
  },
  "sameAs": []
}
```

> **Nota de implementacao:** Preencher `sameAs` com URLs de redes sociais quando existirem (LinkedIn, Instagram, etc.). Adicionar `"telephone"` se houver telefone publico. Substituir `foundingDate` pelo ano correto.

---

### 4.2 WebSite com SearchAction (adicionar na homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Corretor Studio",
  "alternateName": "Corretor Studio CRM",
  "url": "https://www.corretorstudio.com",
  "inLanguage": "pt-BR",
  "publisher": {
    "@type": "Organization",
    "name": "Corretor Studio",
    "url": "https://www.corretorstudio.com"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://www.corretorstudio.com/recursos?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

> **Nota de implementacao:** O `SearchAction` so deve ser incluido se o site tiver funcionalidade de busca ativa. Se `/recursos?q=` nao processar buscas, remover o bloco `potentialAction` e manter apenas o `WebSite` base. Alternativamente, implementar uma busca simples na pagina de recursos para habilitar este schema.

---

### 4.3 SoftwareApplication (adicionar na homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Corretor Studio",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "CRM",
  "operatingSystem": "Web",
  "url": "https://www.corretorstudio.com",
  "description": "Plataforma SaaS de CRM e gestao comercial para corretores de planos de saude. Pipeline Kanban, gestao de equipe, agenda integrada e metricas de conversao.",
  "inLanguage": "pt-BR",
  "screenshot": "https://www.corretorstudio.com/corretor-studio-share-v1.png",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "BRL",
    "price": "0",
    "description": "Periodo de teste gratuito disponivel",
    "availability": "https://schema.org/InStock"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Corretor Studio",
    "url": "https://www.corretorstudio.com"
  },
  "featureList": [
    "CRM com pipeline Kanban",
    "Gestao de equipe comercial",
    "Agenda integrada",
    "Metricas de conversao",
    "Campanhas de e-mail",
    "Integracoes com fontes de leads"
  ]
}
```

> **Nota de implementacao:** Ajustar o campo `price` para o valor real do plano mais barato. Se houver multiplos planos, usar `AggregateOffer` com `lowPrice` e `highPrice`. Adicionar `"aggregateRating"` quando houver avaliacoes publicas. Substituir `screenshot` pela URL de uma imagem real do produto (dashboard/tela principal).

---

### 4.4 BreadcrumbList para Homepage

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home"
    }
  ]
}
```

---

### 4.5 WebPage para Paginas Legais

**`/privacy-policy`:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Politica de Privacidade",
  "url": "https://www.corretorstudio.com/privacy-policy",
  "inLanguage": "pt-BR",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Corretor Studio",
    "url": "https://www.corretorstudio.com"
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.corretorstudio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Politica de Privacidade" }
    ]
  },
  "dateModified": "2026-01-27",
  "publisher": {
    "@type": "Organization",
    "name": "Corretor Studio"
  }
}
```

**`/terms`:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Termos de Uso",
  "url": "https://www.corretorstudio.com/terms",
  "inLanguage": "pt-BR",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Corretor Studio",
    "url": "https://www.corretorstudio.com"
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.corretorstudio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Termos de Uso" }
    ]
  },
  "dateModified": "2026-01-27",
  "publisher": {
    "@type": "Organization",
    "name": "Corretor Studio"
  }
}
```

**`/cookies`:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Politica de Cookies",
  "url": "https://www.corretorstudio.com/cookies",
  "inLanguage": "pt-BR",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Corretor Studio",
    "url": "https://www.corretorstudio.com"
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.corretorstudio.com/" },
      { "@type": "ListItem", "position": 2, "name": "Politica de Cookies" }
    ]
  },
  "dateModified": "2026-01-27",
  "publisher": {
    "@type": "Organization",
    "name": "Corretor Studio"
  }
}
```

---

### 4.6 BreadcrumbList para `/recursos` (complementar CollectionPage existente)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.corretorstudio.com/" },
    { "@type": "ListItem", "position": 2, "name": "Recursos" }
  ]
}
```

---

### 4.7 Correcao: BreadcrumbList nas Subpaginas (remover `item` do ultimo ListItem)

Antes (atual):
```json
{
  "@type": "ListItem",
  "position": 3,
  "name": "CRM para corretores de saude",
  "item": "https://www.corretorstudio.com/recursos/crm-corretores-saude"
}
```

Depois (corrigido):
```json
{
  "@type": "ListItem",
  "position": 3,
  "name": "CRM para corretores de saude"
}
```

Aplicar essa correcao em todas as 6 subpaginas de `/recursos/*`.

---

### 4.8 Schema Combinado Completo para Homepage (pronto para copiar)

Colocar todos os schemas da homepage em um unico bloco `@graph` para eficiencia:

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.corretorstudio.com/#organization",
      "name": "Corretor Studio",
      "url": "https://www.corretorstudio.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.corretorstudio.com/corretor-studio-share-v1.png",
        "width": 1200,
        "height": 630
      },
      "description": "Plataforma SaaS de CRM e gestao comercial para corretores de planos de saude.",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "suporte@corretorstudio.com",
        "contactType": "customer support",
        "availableLanguage": "Portuguese"
      },
      "sameAs": []
    },
    {
      "@type": "WebSite",
      "@id": "https://www.corretorstudio.com/#website",
      "name": "Corretor Studio",
      "alternateName": "Corretor Studio CRM",
      "url": "https://www.corretorstudio.com",
      "inLanguage": "pt-BR",
      "publisher": {
        "@id": "https://www.corretorstudio.com/#organization"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.corretorstudio.com/#software",
      "name": "Corretor Studio",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "CRM",
      "operatingSystem": "Web",
      "url": "https://www.corretorstudio.com",
      "description": "Plataforma SaaS de CRM e gestao comercial para corretores de planos de saude. Pipeline Kanban, gestao de equipe, agenda integrada e metricas de conversao.",
      "inLanguage": "pt-BR",
      "screenshot": "https://www.corretorstudio.com/corretor-studio-share-v1.png",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "BRL",
        "price": "0",
        "description": "Periodo de teste gratuito disponivel",
        "availability": "https://schema.org/InStock"
      },
      "publisher": {
        "@id": "https://www.corretorstudio.com/#organization"
      },
      "featureList": [
        "CRM com pipeline Kanban",
        "Gestao de equipe comercial",
        "Agenda integrada",
        "Metricas de conversao",
        "Campanhas de e-mail",
        "Integracoes com fontes de leads"
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home"
        }
      ]
    }
  ]
}
</script>
```

> **Antes de copiar para producao:** (1) Preencher `sameAs` com perfis sociais, (2) ajustar `price` no `Offer` para o plano real, (3) substituir `screenshot` por imagem do produto, (4) remover `SearchAction` se nao houver busca implementada.

---

## 5. Matriz de Prioridade

| Prioridade | Acao | Pagina(s) | Impacto | Esforco |
|------------|------|-----------|---------|---------|
| **P0 -- CRITICA** | Adicionar Organization + WebSite + SoftwareApplication | Homepage `/` | Knowledge Panel do Google, classificacao como SaaS, citacoes AI, elegibilidade para rich results | Baixo -- copiar JSON-LD da secao 4.8 |
| **P1 -- ALTA** | Corrigir BreadcrumbList (remover `item` do ultimo ListItem) | 6 paginas `/recursos/*` | Conformidade com recomendacao Google, evitar warnings no Rich Results Test | Baixo -- editar 6 arquivos |
| **P1 -- ALTA** | Adicionar `url` ao CollectionPage | `/recursos` | Schema mais completo para crawlers | Minimo -- 1 propriedade |
| **P2 -- MEDIA** | Adicionar BreadcrumbList ao `/recursos` | `/recursos` | Consistencia de navegacao estruturada | Baixo |
| **P2 -- MEDIA** | Adicionar WebPage + BreadcrumbList nas paginas legais | `/privacy-policy`, `/terms`, `/cookies` | Identificacao de tipo de pagina para crawlers e AI | Baixo |
| **P3 -- BAIXA** | Corrigir acentuacao nos textos de FAQ | 6 paginas `/recursos/*` | Legibilidade para usuarios e LLMs | Medio -- revisar todos os textos |
| **P3 -- BAIXA** | Adicionar Article/WebPage complementar nas subpaginas de recursos | 6 paginas `/recursos/*` | Enriquecimento semantico | Baixo |
| **FUTURO** | Adicionar AggregateRating ao SoftwareApplication | Homepage | Rich results com estrelas -- requer avaliacoes publicas reais | Depende de ter reviews |
| **FUTURO** | Adicionar SearchAction ao WebSite | Homepage | Sitelinks search box -- requer busca funcional | Depende de implementacao |

---

## 6. Resumo Executivo

### O que esta BOM:
- Paginas de recursos (`/recursos/*`) tem BreadcrumbList + FAQPage consistentes
- Pagina indice (`/recursos`) tem CollectionPage + ItemList bem estruturado
- Todos os schemas usam JSON-LD (formato preferido pelo Google)
- URLs absolutas em todos os schemas
- Estrutura sintatica JSON valida em todas as marcacoes

### O que esta CRITICO:
- **Homepage sem NENHUM schema** -- a pagina mais importante do site nao tem Organization, WebSite, nem SoftwareApplication
- Sem Organization, o Google nao consegue construir Knowledge Panel da marca
- Sem SoftwareApplication, o produto nao e classificado como software nos resultados de busca
- Sem WebSite, perde elegibilidade para sitelinks search box

### O que precisa CORRECAO:
- BreadcrumbList com `item` no ultimo ListItem (6 paginas)
- CollectionPage sem `url`
- Textos de FAQ sem acentuacao portuguesa

### Proximo passo imediato:
Implementar o bloco `@graph` da secao 4.8 no `<head>` da homepage. Isso resolve o problema mais critico (P0) com uma unica alteracao.
