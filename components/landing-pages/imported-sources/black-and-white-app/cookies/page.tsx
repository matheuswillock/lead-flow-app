import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '../../black-and-white-components/legal-page'
import SiteFooter from '../../black-and-white-components/site-footer'

export const metadata: Metadata = { title: 'Política de Cookies | Sua marca', description: 'Entenda como Sua marca utiliza cookies e tecnologias semelhantes.' }
const sections: LegalSection[] = [
  { number: '01', title: 'O que são cookies', text: '[Explique de forma simples o que são cookies e tecnologias semelhantes.]' },
  { number: '02', title: 'Cookies necessários', text: '[Descreva os cookies essenciais para funcionamento, segurança e recursos básicos.]' },
  { number: '03', title: 'Cookies de análise', text: '[Descreva se e como dados de uso ajudam a entender e melhorar a experiência.]' },
  { number: '04', title: 'Cookies de marketing', text: '[Descreva tecnologias usadas para medir campanhas, caso aplicável.]' },
  { number: '05', title: 'Cookies de preferências', text: '[Descreva como escolhas de navegação podem ser lembradas.]' },
  { number: '06', title: 'Como alterar suas escolhas', text: '[Explique como revisar ou retirar consentimentos. O usuário também pode abrir Preferências de Cookies no rodapé.]' },
  { number: '07', title: 'Prazo de armazenamento', text: '[Informe os períodos de retenção por categoria e os critérios utilizados.]' },
  { number: '08', title: 'Contato', text: '[Informe o canal oficial para dúvidas sobre cookies e privacidade.]' },
]
export default function CookiesPage() { return <><LegalPage title="Política de Cookies" description="Veja como utilizamos cookies e tecnologias semelhantes nesta página." sections={sections} /><section className="cookie-table-section"><div className="container"><p className="eyebrow">Inventário futuro</p><h2>Cookies utilizados</h2><div className="cookie-table"><div className="cookie-table-head"><span>Cookie</span><span>Categoria</span><span>Finalidade</span><span>Fornecedor</span><span>Duração</span></div><div className="cookie-placeholder-row"><strong>[COOKIE_NAME]</strong><span><b>Categoria</b>[CATEGORIA]</span><span><b>Finalidade</b>[FINALIDADE]</span><span><b>Fornecedor</b>[FORNECEDOR]</span><span><b>Duração</b>[PERÍODO]</span></div></div></div></section><SiteFooter /></> }
