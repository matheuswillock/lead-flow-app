import { Badge } from "@/components/ui/badge";

/** Exportado só para o teste validar este texto literal contra uma entrega real (R20-5). */
export const NODE_VERIFY_SAMPLE = `import crypto from "node:crypto";

function isValidCorretorStudioSignature(secret, timestamp, rawBody, signatureHeader) {
  // Nunca comparar sem checar presença e tamanho antes — timingSafeEqual lança
  // exceção (em vez de devolver false) quando os buffers têm tamanhos diferentes,
  // e um header ausente ou forjado com outro tamanho não pode derrubar o receptor.
  if (!timestamp || !signatureHeader) {
    return false;
  }

  const fiveMinutesMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > fiveMinutesMs) {
    return false; // timestamp fora da janela de 5 minutos
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(\`\${timestamp}.\${rawBody}\`) // rawBody = corpo bruto, sem reformatar o JSON
      .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}`;

const HEADERS: Array<{ name: string; description: string }> = [
  { name: "X-Corretor-Studio-Signature", description: "sha256=<hmac> do timestamp + \".\" + corpo bruto" },
  { name: "X-Corretor-Studio-Timestamp", description: "segundos desde epoch — rejeite se tiver mais de 5 minutos" },
  { name: "X-Corretor-Studio-Event-Version", description: "versão do envelope de evento, hoje sempre \"1\"" },
];

export function WebhookSignatureVerificationGuide() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Como verificar a assinatura</h3>
        <p className="text-sm text-muted-foreground">
          Calcule o HMAC-SHA256 do timestamp concatenado ao corpo bruto da requisição
          (sem reformatar o JSON) usando o segredo do webhook, e compare com o header
          de assinatura numa comparação de tempo constante.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {HEADERS.map((header) => (
          <div key={header.name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <Badge variant="outline" className="w-fit font-mono text-xs">
              {header.name}
            </Badge>
            <span className="text-sm text-muted-foreground">{header.description}</span>
          </div>
        ))}
      </div>

      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
        <code className="font-mono">{NODE_VERIFY_SAMPLE}</code>
      </pre>
    </div>
  );
}
