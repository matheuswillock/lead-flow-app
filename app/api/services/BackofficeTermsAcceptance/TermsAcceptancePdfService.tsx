import React from "react"
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import type { LegalDocumentBlock } from "./IBackofficeTermsAcceptanceService"
import type { BackofficeTermsAcceptanceRepository } from "@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository"

export const TERMS_ACCEPTANCE_PDF_GENERATOR_VERSION = "1.0.0"

type AcceptanceForPdf = NonNullable<Awaited<ReturnType<BackofficeTermsAcceptanceRepository["findAcceptanceForPdf"]>>>

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 52, paddingHorizontal: 44, fontSize: 9, color: "#27272a", lineHeight: 1.5 },
  title: { fontSize: 19, fontWeight: 700, marginBottom: 14 },
  heading: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  subheading: { fontSize: 10, fontWeight: 700, marginTop: 9, marginBottom: 4 },
  paragraph: { marginBottom: 6, textAlign: "justify" },
  meta: { color: "#52525b", marginBottom: 4 },
  evidence: { padding: 12, border: "1 solid #d4d4d8", marginBottom: 16 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 24, fontSize: 8, color: "#71717a", flexDirection: "row", justifyContent: "space-between" },
})

function Block({ block }: { block: LegalDocumentBlock }) {
  if (block.kind === "heading") return <Text style={styles.heading}>{block.text}</Text>
  if (block.kind === "subheading") return <Text style={styles.subheading}>{block.text}</Text>
  if (block.kind === "meta") return <Text style={styles.meta}>{block.text}</Text>
  if (block.kind === "listItem" || block.kind === "romanItem") return <Text style={styles.paragraph}>• {block.text}</Text>
  return <Text style={styles.paragraph}>{block.text}</Text>
}

function AcceptanceEvidenceDocument({ acceptance }: { acceptance: AcceptanceForPdf }) {
  return <Document title={`Comprovante ${acceptance.protocol}`} author="Corretor Studio">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.title}>Comprovante de aceite eletrônico</Text>
      <View style={styles.evidence}>
        <Text>Protocolo: {acceptance.protocol}</Text>
        <Text>Aceito em: {acceptance.acceptedAt.toISOString()}</Text>
        <Text>Empresa: {acceptance.companyLegalName} · CNPJ {acceptance.companyCnpj}</Text>
        <Text>Representante: {acceptance.representativeName} · CPF {acceptance.representativeCpf}</Text>
        <Text>Cargo: {acceptance.representativeRole}</Text>
        <Text>E-mail: {acceptance.representativeEmail}</Text>
        <Text>IP: {acceptance.ipAddress ?? "não disponível"}</Text>
        <Text>User agent: {acceptance.userAgent}</Text>
      </View>
      {acceptance.documents.map((document) => <View key={document.id} break>
        <Text style={styles.heading}>{document.documentTitle} · versão {document.documentVersion}</Text>
        <Text style={styles.meta}>Publicado em {document.documentPublishedAt.toISOString()} · SHA-256 {document.documentContentHash}</Text>
        {(document.documentContent as LegalDocumentBlock[]).map((block, index) => <Block key={`${document.id}-${index}`} block={block} />)}
      </View>)}
      <View style={styles.footer} fixed><Text>{acceptance.protocol}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} /></View>
    </Page>
  </Document>
}

export class TermsAcceptancePdfService {
  async render(acceptance: AcceptanceForPdf): Promise<Buffer> {
    return renderToBuffer(<AcceptanceEvidenceDocument acceptance={acceptance} />)
  }
}

export const termsAcceptancePdfService = new TermsAcceptancePdfService()
