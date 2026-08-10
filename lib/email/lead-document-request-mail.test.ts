import { beforeEach, describe, expect, it, mock } from "bun:test";

type SendEmailResult =
  | { success: true; data: { data: { id: string } } }
  | { success: false; error: string };

const sendEmailMock = mock(
  async (_options: {
    to: string[];
    subject: string;
    html: string;
    tracking: {
      teamId: string;
      category: string;
      sourceType: string;
      sourceId: string;
    };
  }): Promise<SendEmailResult> => ({
    success: true,
    data: { data: { id: "re_test" } },
  })
);

mock.module("@/lib/services/EmailService", () => ({
  getEmailService: () => ({
    sendEmail: sendEmailMock,
  }),
}));

mock.module("@react-email/render", () => ({
  render: mock(async () => "<p>rendered html</p>"),
}));

const { sendLeadDocumentRequestEmail, sendLeadDocumentUploadedEmail } = await import(
  "./lead-document-request-mail"
);

describe("lead-document-request-mail", () => {
  beforeEach(() => {
    sendEmailMock.mockClear();
    sendEmailMock.mockImplementation(async () => ({
      success: true,
      data: { data: { id: "re_test" } },
    }));
  });

  it("sendLeadDocumentRequestEmail passa tracking com team_id ao EmailService.sendEmail", async () => {
    const teamId = "team-abc-123";

    await sendLeadDocumentRequestEmail("lead@example.com", {
      teamId,
      requestId: "req-1",
      closerName: "João",
      leadName: "Maria",
      publicUrl: "https://app.test/documentos/token",
      documents: ["RG", "CPF"],
      message: "Envie os docs",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to: string[];
      subject: string;
      html: string;
      tracking: {
        teamId: string;
        category: string;
        sourceType: string;
        sourceId: string;
      };
    };
    expect(payload.to).toEqual(["lead@example.com"]);
    expect(payload.subject).toBe("[Corretor Studio] João solicitou seus documentos");
    expect(payload.html).toBe("<p>rendered html</p>");
    expect(payload.tracking.teamId).toBe(teamId);
    expect(payload.tracking.category).toBe("transactional");
    expect(payload.tracking.sourceType).toBe("lead-document-request");
    expect(payload.tracking.sourceId).toBe("req-1");
  });

  it("sendLeadDocumentUploadedEmail passa tracking com team_id ao EmailService.sendEmail", async () => {
    const teamId = "team-xyz-456";

    await sendLeadDocumentUploadedEmail("closer@example.com", {
      teamId,
      documentId: "item-99",
      closerName: "Ana",
      leadName: "Carlos",
      documentName: "rg.pdf",
      leadCode: "L-001",
      supabaseId: "supabase-1",
      appUrl: "https://app.test",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to: string[];
      subject: string;
      html: string;
      tracking: {
        teamId: string;
        category: string;
        sourceType: string;
        sourceId: string;
      };
    };
    expect(payload.to).toEqual(["closer@example.com"]);
    expect(payload.subject).toBe("[Corretor Studio] Carlos enviou um documento");
    expect(payload.html).toBe("<p>rendered html</p>");
    expect(payload.tracking.teamId).toBe(teamId);
    expect(payload.tracking.category).toBe("transactional");
    expect(payload.tracking.sourceType).toBe("lead-document-uploaded");
    expect(payload.tracking.sourceId).toBe("item-99");
  });

  it("propaga erro quando EmailService.sendEmail falha", async () => {
    sendEmailMock.mockImplementationOnce(async () => ({
      success: false,
      error: "Resend indisponível",
    }));

    await expect(
      sendLeadDocumentRequestEmail("lead@example.com", {
        teamId: "team-1",
        requestId: "req-err",
        closerName: "João",
        leadName: "Maria",
        publicUrl: "https://app.test/documentos/token",
        documents: ["RG"],
      })
    ).rejects.toThrow("Falha ao enviar e-mail: Resend indisponível");
  });
});
