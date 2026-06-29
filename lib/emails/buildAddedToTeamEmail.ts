export function buildAddedToTeamEmail(params: { userName: string; loginUrl: string }): string {
  const { userName, loginUrl } = params;
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
                    <h1 style="margin:0;font-size:22px;">Corretor Studio</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px;">
                    <h2 style="margin:0 0 12px 0;color:#171717;font-size:20px;">Você foi adicionado a um novo time</h2>
                    <p style="margin:0 0 16px 0;color:#525252;line-height:1.5;">
                      Olá, <strong>${userName}</strong>. Você foi adicionado a um novo time no Corretor Studio.
                    </p>
                    <div style="margin-top:24px;">
                      <a href="${loginUrl}" style="display:inline-block;background:#ff6900;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                        Acessar a plataforma
                      </a>
                    </div>
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
