import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import type { ILegalPageService } from "./ILegalPageService"
import type { LegalDocumentKind, PublicLegalDocument, LegalSection } from "../context/LegalPageTypes"

const value = (snapshot: LandingPageSnapshot) => snapshot.content.templateConfig
const contact = (snapshot: LandingPageSnapshot) => value(snapshot)?.contact ?? {}
const identity = (snapshot: LandingPageSnapshot) => value(snapshot)?.identity
const phone = (input?: string) => { const digits = (input ?? "").replace(/\D/g, "").replace(/^55/, ""); if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`; if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`; return input ?? "" }
const cnpj = (input?: string) => { const digits = (input ?? "").replace(/\D/g, ""); return digits.length === 14 ? `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}` : input ?? "" }
const section = (id: string, title: string, text: string, bullets?: string[]): LegalSection => ({ id, title, text, bullets })

function buildSections(kind: LegalDocumentKind, snapshot: LandingPageSnapshot): LegalSection[] {
  const brand = identity(snapshot)?.tradeName || snapshot.content.brandName || ""
  const legal = identity(snapshot)?.legalName
  const mail = contact(snapshot).email
  const whats = phone(contact(snapshot).whatsappE164 || contact(snapshot).phoneDisplay)
  if (kind === "privacidade") return [
    section("escopo", "Sobre esta política", `${brand} apresenta como trata as informações compartilhadas nesta página para solicitar orientação sobre planos de saúde.${legal ? ` A responsável informada é ${legal}.` : ""}`),
    section("dados", "Dados coletados", "Podemos receber os dados que você decide informar no formulário, como nome, telefone, WhatsApp, e-mail e informações sobre seu cenário.", ["Dados de identificação e contato", "Respostas e informações enviadas no formulário", "Dados técnicos necessários ao funcionamento da página"]),
    section("finalidades", "Como utilizamos os dados", "As informações são usadas para entender sua solicitação, comparar possibilidades e permitir que a corretora entre em contato sobre o atendimento solicitado."),
    section("analytics", "Medição de uso", "Eventos de análise da página somente são registrados quando você autoriza analytics nas preferências de cookies."),
    section("direitos", "Seus direitos", `Para dúvidas ou solicitações relacionadas aos seus dados, entre em contato${mail ? ` pelo e-mail ${mail}` : whats ? ` pelo WhatsApp ${whats}` : " pelo canal informado nesta página"}.`),
  ]
  if (kind === "cookies") return [
    section("o-que-sao", "O que são cookies", "Cookies são pequenos arquivos ou identificadores armazenados pelo navegador para permitir o funcionamento da página e lembrar preferências."),
    section("necessarios", "Cookies necessários", "Usamos o armazenamento necessário para manter a página funcional e registrar a escolha feita no aviso de consentimento."),
    section("analise", "Cookies de análise", "Recursos de analytics só são ativados depois que você autoriza a categoria de análise. Sem autorização, esses eventos não são registrados."),
    section("marketing", "Cookies de marketing", "Não há cookies de marketing configurados nesta landing quando essa categoria não aparece nas preferências disponíveis."),
    section("preferencias", "Como alterar suas escolhas", "Você pode reabrir Preferências de Cookies pelo link no rodapé e salvar uma nova escolha. A alteração vale para as próximas interações na página."),
  ]
  return [
    section("finalidade", "Finalidade da página", `${brand} disponibiliza esta página para receber informações e ajudar você a comparar possibilidades de planos de saúde.`),
    section("envio", "Envio voluntário", "O preenchimento do formulário é voluntário. Ao enviar informações, você permite que a corretora avalie a solicitação e entre em contato pelos canais informados."),
    section("limites", "Limites da análise", "As informações apresentadas ou discutidas não representam garantia de contratação, preço, disponibilidade, cobertura ou resultado. As condições dependem do perfil e das regras aplicáveis a cada produto."),
    section("contato", "Canais oficiais", `${mail ? `E-mail: ${mail}.` : ""}${whats ? ` WhatsApp: ${whats}.` : ""}`.trim() || "Use os canais de contato exibidos nesta página."),
  ]
}

export const legalPageService: ILegalPageService = { async getPublic(landingPageId, kind) {
  const output = await landingPageUseCase.getPublic(landingPageId)
  if (!output.isValid || !output.result) return null
  const snapshot = (output.result as { snapshot: LandingPageSnapshot }).snapshot
  const base = `/conversao/${landingPageId}`
  const title = kind === "privacidade" ? "Política de Privacidade" : kind === "cookies" ? "Política de Cookies" : "Termos de Uso"
  const brand = identity(snapshot)?.tradeName || snapshot.content.brandName || ""
  return { kind, snapshot, title, description: `${title} de ${brand}.`, sections: buildSections(kind, snapshot), links: { privacidade: `${base}/privacidade`, cookies: `${base}/cookies`, termos: `${base}/termos` } }
} }

export { cnpj, phone }
