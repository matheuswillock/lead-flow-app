export function buildBethaniaAuthCodeEmail(params: {
  userName: string;
  code: string;
  expiresMinutes?: number;
}): string {
  const { userName, code, expiresMinutes = 10 } = params;
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:24px;">
              <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#ff6900;color:#ffffff;padding:24px;text-align:center;">
                    <h1 style="margin:0;font-size:22px;">Bethânia · Corretor Studio</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px;">
                    <h2 style="margin:0 0 12px 0;color:#171717;font-size:20px;">Seu código de verificação</h2>
                    <p style="margin:0 0 16px 0;color:#525252;line-height:1.5;">
                      Olá, <strong>${userName}</strong>. Use o código abaixo na conversa com a Bethânia no WhatsApp.
                    </p>
                    <p style="margin:0 0 8px 0;text-align:center;font-size:32px;letter-spacing:0.2em;font-weight:700;color:#171717;">
                      ${code}
                    </p>
                    <p style="margin:16px 0 0 0;color:#737373;font-size:14px;line-height:1.5;text-align:center;">
                      Válido por ${expiresMinutes} minutos. Se você não solicitou este código, ignore este e-mail.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
