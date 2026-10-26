import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '../../black-and-white-components/legal-page'
import SiteFooter from '../../black-and-white-components/site-footer'

export const metadata: Metadata = { title: 'Política de Privacidade | Sua marca', description: 'Saiba como Sua marca trata informações e dados pessoais.' }
const sections: LegalSection[] = [
  { number: '01', title: 'Sobre esta política', text: '[Explique aqui o objetivo desta política, quem é a empresa responsável e a quem este documento se aplica.]' },
  { number: '02', title: 'Dados coletados', text: '[Descreva os dados que podem ser informados pelo usuário ou coletados durante a navegação.]', bullets: ['Dados de contato e identificação', 'Informações compartilhadas no formulário', 'Dados técnicos de navegação, quando aplicável'] },
  { number: '03', title: 'Como utilizamos os dados', text: '[Descreva as finalidades de uso, sempre com linguagem clara e objetiva.]' },
  { number: '04', title: 'Compartilhamento', text: '[Informe quando dados podem ser compartilhados, com quais categorias de parceiros e por quê.]' },
  { number: '05', title: 'Armazenamento e segurança', text: '[Descreva as medidas de proteção e os critérios de retenção aplicáveis.]' },
  { number: '06', title: 'Seus direitos', text: '[Apresente os direitos previstos na legislação aplicável e como o usuário pode exercê-los.]' },
  { number: '07', title: 'Cookies', text: 'Para entender como usamos cookies e tecnologias semelhantes, consulte a nossa Política de Cookies.', bullets: ['Consultar a Política de Cookies', 'Revisar suas preferências de consentimento'] },
  { number: '08', title: 'Contato', text: '[Informe o canal oficial para dúvidas, solicitações e assuntos relacionados à privacidade.]' },
]
export default function PrivacyPage() { return <><LegalPage title="Política de Privacidade" description="Entenda como suas informações podem ser coletadas, utilizadas e protegidas." sections={sections} /><SiteFooter /></> }
