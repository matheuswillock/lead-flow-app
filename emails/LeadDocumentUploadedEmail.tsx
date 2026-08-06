import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import * as React from "react";

export type LeadDocumentUploadedEmailProps = {
  closerName: string;
  leadName: string;
  documentName: string;
  leadCode: string;
  supabaseId: string;
  appUrl: string;
};

export function LeadDocumentUploadedEmail({
  closerName,
  leadName,
  documentName,
  leadCode,
  supabaseId,
  appUrl,
}: LeadDocumentUploadedEmailProps) {
  const baseUrl = appUrl.replace(/\/$/, "");
  const crmUrl = `${baseUrl}/${supabaseId}/crm?leadCode=${encodeURIComponent(leadCode)}`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{leadName} enviou um documento para você no Corretor Studio</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Heading style={brandStyle}>Corretor Studio</Heading>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h2" style={titleStyle}>
              Documento recebido!
            </Heading>

            <Text style={textStyle}>
              Olá, <strong>{closerName}</strong>!
            </Text>

            <Text style={textStyle}>
              O lead <strong>{leadName}</strong> enviou o documento:
            </Text>

            <Section style={documentBoxStyle}>
              <Text style={documentNameStyle}>{documentName}</Text>
            </Section>

            <Hr style={dividerStyle} />

            <Section style={ctaSection}>
              <Button href={crmUrl} style={buttonStyle}>
                Ver no CRM
              </Button>
            </Section>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerSignStyle}>Corretor Studio</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "40px auto",
  maxWidth: "600px",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#1e40af",
  padding: "24px 32px",
  textAlign: "center",
};

const brandStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  padding: "32px",
};

const titleStyle: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 16px 0",
};

const textStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 12px 0",
};

const documentBoxStyle: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  borderRadius: "6px",
  padding: "14px 20px",
  margin: "0 0 16px 0",
};

const documentNameStyle: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "15px",
  fontWeight: 600,
  margin: 0,
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "24px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#1e40af",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "14px 28px",
  textDecoration: "none",
};

const footerStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
  padding: "16px 32px",
  textAlign: "center",
};

const footerSignStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: 0,
};

export default LeadDocumentUploadedEmail;
