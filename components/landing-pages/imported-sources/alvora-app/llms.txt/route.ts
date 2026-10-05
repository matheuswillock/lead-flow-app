import { getSiteUrl } from '../../alvora-lib/site-url'

export function GET() {
  const siteUrl = getSiteUrl()
  const content = `# Alvora Corretora

> Consultoria para comparar planos de saúde individuais, familiares e empresariais.

A Alvora ajuda pessoas, famílias, empresários, MEIs e empresas a comparar alternativas de planos de saúde entre operadoras parceiras.

**Soluções:**

- Planos empresariais para contratação via CNPJ.
- Alternativas para empresários, dependentes elegíveis e equipes.
- Planos individuais e familiares.
- Opções para pessoas a partir dos 44 anos.
- Planos por adesão para categorias elegíveis.
- Assistência odontológica individual e empresarial.

**Como funciona:**

A Alvora analisa o perfil do cliente, identifica opções disponíveis, compara preços, coberturas, rede credenciada, carências e condições de contratação, e acompanha o processo de contratação e pós-venda.

**Perguntas frequentes:**

- A contratação pelo CNPJ depende das condições da operadora, do produto e da documentação exigida.
- MEIs podem ter acesso a determinados planos empresariais, conforme as regras aplicáveis e a elegibilidade do contrato.
- A quantidade mínima de beneficiários varia conforme o plano e a operadora.
- Preços dependem de idade, região, tipo de contratação, cobertura e quantidade de beneficiários.
- Portabilidade e aproveitamento de carências dependem do contrato atual e dos requisitos aplicáveis.

## Contato e atendimento

- [Telefone: (11) 3178-4000](tel:+551131784000): atendimento comercial.
- [WhatsApp da Alvora](https://wa.me/551131784000): fale com a equipe para receber orientação.
- [Site da Alvora](${siteUrl}/): página principal da corretora.

## Seções

- [Página inicial](${siteUrl}/): visão geral dos serviços e formas de atendimento.
- [Plano de Saúde Empresarial](${siteUrl}/#empresarial): alternativas para empresários, MEIs e empresas elegíveis.
- [Plano de Saúde para Pessoa Física](${siteUrl}/#pessoa-fisica): opções individuais, familiares e para pessoas a partir dos 44 anos.
- [Como funciona](${siteUrl}/#como-funciona): etapas de análise, comparação e contratação.
- [Dúvidas frequentes](${siteUrl}/#faq): respostas sobre CNPJ, MEI, carências, beneficiários e valores.
- [Contato](${siteUrl}/#contato): formulário para solicitar uma cotação.
`

  return new Response(content, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
