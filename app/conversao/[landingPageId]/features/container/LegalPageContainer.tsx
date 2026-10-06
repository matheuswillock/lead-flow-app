import Link from "next/link"
import { LegalPageProvider } from "../context/LegalPageContext"
import type { PublicLegalDocument } from "../context/LegalPageTypes"
import { cnpj, phone } from "../services/LegalPageService"

export function LegalPageContainer({ document }: { document: PublicLegalDocument }) {
  const config = document.snapshot.content.templateConfig
  const brand = config?.identity.tradeName || document.snapshot.content.brandName || ""
  const legalName = config?.identity.legalName
  const email = config?.contact.email
  const contactPhone = phone(config?.contact.phoneDisplay || config?.contact.phoneE164)
  const documentDate = new Date(document.snapshot.publishedAt).toLocaleDateString("pt-BR")
  return <LegalPageProvider value={document}><main className={`public-legal public-legal-${config?.templateSlug ?? "default"}`}><header><Link href={`/conversao/${document.snapshot.landingPageId}`} aria-label={`${brand} — início`}>{brand}</Link><nav aria-label="Documentos legais">{Object.entries(document.links).map(([key, href]) => <Link key={key} href={href}>{key === "privacidade" ? "Privacidade" : key === "cookies" ? "Cookies" : "Termos"}</Link>)}</nav></header><article><p className="public-legal-eyebrow">Transparência</p><h1>{document.title}</h1><p className="public-legal-description">{document.description}</p><p className="public-legal-date">Última atualização: {documentDate}</p>{document.sections.map((item, index) => <section key={item.id} id={item.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.title}</h2><p>{item.text}</p>{item.bullets && <ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}<aside><strong>Identificação e contato</strong>{legalName && <p>Razão social: {legalName}</p>}{config?.identity.cnpj && <p>CNPJ: {cnpj(config.identity.cnpj)}</p>}{email && <p>E-mail: <a href={`mailto:${email}`}>{email}</a></p>}{contactPhone && <p>Telefone: <a href={`tel:+55${contactPhone.replace(/\D/g, "")}`}>{contactPhone}</a></p>}</aside></article><footer><span>© {new Date().getFullYear()} {brand}</span><span>Made with ♥ by Willock&apos;s House</span></footer></main></LegalPageProvider>
}
