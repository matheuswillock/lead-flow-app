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

export type LeadDocumentRequestEmailProps = {
  closerName: string;
  leadName: string;
  publicUrl: string;
  documents: string[];
  message?: string;
};

export function LeadDocumentRequestEmail({
  closerName,
  leadName,
  publicUrl,
  documents,
  message,
}: LeadDocumentRequestEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{closerName} solicitou seus documentos no Corretor Studio</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Heading style={brandStyle}>Corretor Studio</Heading>
          </Section>

          <Section style={contentStyle}>
            <Heading as="h2" style={titleStyle}>
              Olá, {leadName}!
            </Heading>

            <Text style={textStyle}>
              <strong>{closerName}</strong> solicitou o envio dos seguintes documentos:
            </Text>

            <Section style={documentListStyle}>
              {documents.map((doc, index) => (
                <Text key={index} style={documentItemStyle}>
                  • {doc}
                </Text>
              ))}
            </Section>

            {message && (
              <>
                <Hr style={dividerStyle} />
                <Text style={labelStyle}>Mensagem do corretor:</Text>
                <Text style={messageStyle}>{message}</Text>
              </>
            )}

            <Hr style={dividerStyle} />

            <Section style={ctaSection}>
              <Button href={publicUrl} style={buttonStyle}>
                Enviar Documentos
              </Button>
            </Section>

            <Text style={footerTextStyle}>
              Se você não conseguir clicar no botão, copie e cole o link abaixo no seu navegador:
            </Text>
            <Text style={linkTextStyle}>{publicUrl}</Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerSignStyle}>
              Enviado por {closerName} via Corretor Studio
            </Text>
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
  margin: "0 0 16px 0",
};

const documentListStyle: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 16px 0",
};

const documentItemStyle: React.CSSProperties = {
  color: "#1e293b",
  fontSize: "14px",
  lineHeight: "1.8",
  margin: "0",
};

const labelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  margin: "0 0 8px 0",
  textTransform: "uppercase",
};

const messageStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderLeft: "3px solid #1e40af",
  borderRadius: "0 4px 4px 0",
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
  padding: "12px 16px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#e2e8f0",
  margin: "24px 0",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center",
  margin: "0 0 20px 0",
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

const footerTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px 0",
  textAlign: "center",
};

const linkTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  margin: "0",
  textAlign: "center",
  wordBreak: "break-all",
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

export default LeadDocumentRequestEmail;
