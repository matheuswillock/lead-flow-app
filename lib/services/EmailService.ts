import { assertResend } from "@/lib/email";

export interface EmailOptions {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  loginUrl?: string;
}

export interface LeadNotificationData {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  managerName: string;
  managerEmail: string;
}

export interface SubscriptionConfirmationData {
  userName: string;
  userEmail: string;
  subscriptionId?: string;
  planName?: string;
  value?: number; // BRL
  nextDueDate?: string; // ISO
  manageUrl?: string; // URL para gerenciar assinatura
}

export interface OperatorInviteEmailData {
  operatorName: string;
  operatorEmail: string;
  operatorRole: string;
  managerName: string;
  inviteUrl: string;
}

export interface ResetPasswordEmailData {
  userName: string;
  userEmail: string;
  resetUrl: string;
}

export class EmailService {
  private resend?: ReturnType<typeof assertResend>;

  private getResend() {
    if (!this.resend) {
      try {
        this.resend = assertResend();
      } catch {
        throw new Error("RESEND_API_KEY não configurada. Configure a variável de ambiente para enviar emails.");
      }
    }
    return this.resend;
  }

  // Método genérico para enviar emails
  async sendEmail(options: EmailOptions) {
    try {
      const resend = this.getResend();
      
      // NOTA: Resend sem domínio verificado só envia para o e-mail do owner da conta
      // Para produção, verificar domínio em: https://resend.com/domains
      // 
      // MODO DESENVOLVIMENTO: Enviar todos os e-mails para o owner em vez do destinatário real
      const isDevelopment = process.env.NODE_ENV === 'development';
      const resendOwnerEmail = process.env.RESEND_OWNER_EMAIL || 'matheuswillock@gmail.com';
      
      const emailData: any = {
        from: options.from || "Corretor Studio <onboarding@resend.dev>",
        to: isDevelopment ? [resendOwnerEmail] : options.to,
        subject: isDevelopment 
          ? `[DEV - Para: ${options.to.join(', ')}] ${options.subject}`
          : options.subject,
      };

      if (options.html) {
        // Adicionar banner de desenvolvimento no topo do e-mail
        if (isDevelopment) {
          const devBanner = `
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-weight: 600;">
                🧪 MODO DESENVOLVIMENTO
              </p>
              <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">
                Este e-mail seria enviado para: <strong>${options.to.join(', ')}</strong>
              </p>
            </div>
          `;
          emailData.html = devBanner + options.html;
        } else {
          emailData.html = options.html;
        }
      }
      if (options.text) {
        emailData.text = options.text;
      }

      const result = await resend.emails.send(emailData);
      return { success: true, data: result };
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      return { success: false, error: error.message };
    }
  }

  // Email de boas-vindas para novos usuários
  async sendWelcomeEmail(data: WelcomeEmailData) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!-- Container Principal -->
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Gestão Inteligente de Leads</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600;">Bem-vindo, ${data.userName}! 🎉</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6;">
                      Sua conta foi criada com <strong>sucesso</strong>! Agora você tem acesso a uma plataforma completa para gerenciar seus leads de forma eficiente e profissional.
                    </p>
                    
                    <!-- Cards de Recursos -->
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px 0; color: #171717; font-size: 18px; font-weight: 600;">O que você pode fazer:</h3>
                      <ul style="margin: 0; padding: 0; list-style: none;">
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Gerenciar leads com interface Kanban visual</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Acompanhar métricas e performance em tempo real</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Colaborar com sua equipe de operadores</span>
                        </li>
                        <li style="margin-bottom: 0; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Otimizar seu processo comercial</span>
                        </li>
                      </ul>
                    </div>
                    
                    ${data.loginUrl ? `
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${data.loginUrl}" 
                         style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🚀 Acessar Plataforma
                      </a>
                    </div>
                    ` : ''}
                    
                    <p style="margin: 24px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6;">
                      Precisa de ajuda? Estamos aqui para você! Entre em contato conosco a qualquer momento.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 8px 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
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

    return this.sendEmail({
      to: [data.userEmail],
      subject: "Bem-vindo ao Corretor Studio - Sua conta foi criada!",
      html,
    });
  }

  // Confirmação de assinatura
  async sendSubscriptionConfirmationEmail(data: SubscriptionConfirmationData) {
    const fmtCurrency = (v?: number) =>
      typeof v === 'number'
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
        : undefined;

    const price = fmtCurrency(data.value);
    const nextDue = data.nextDueDate ? new Date(data.nextDueDate).toLocaleDateString('pt-BR') : undefined;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const manageUrl = data.manageUrl || `${appUrl}/sign-in`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); border-radius: 50%; margin-bottom: 16px;">
                        <span style="font-size: 40px; line-height: 72px; display: block;">🎉</span>
                      </div>
                    </div>
                    
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Assinatura Confirmada!</h2>
                    
                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.userName}</strong>, sua assinatura no Corretor Studio foi confirmada com sucesso.
                    </p>
                    
                    <!-- Detalhes da Assinatura -->
                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 2px solid #ff6900; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px 0; color: #7c2d12; font-size: 16px; font-weight: 600; text-align: center;">📋 Detalhes da Assinatura</h3>
                      ${data.subscriptionId ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">ID da Assinatura</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 15px; font-family: monospace;">${data.subscriptionId}</p>
                      </div>
                      ` : ''}
                      ${data.planName ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Plano</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 16px; font-weight: 600;">${data.planName}</p>
                      </div>
                      ` : ''}
                      ${price ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Valor Mensal</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 20px; font-weight: 700;">${price}</p>
                      </div>
                      ` : ''}
                      ${nextDue ? `
                      <div style="margin-bottom: 0;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Próximo Vencimento</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 16px; font-weight: 600;">${nextDue}</p>
                      </div>
                      ` : ''}
                    </div>
                    
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${manageUrl}"
                         style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🚀 Acessar Plataforma
                      </a>
                    </div>
                    
                    <p style="margin: 24px 0 0 0; color: #525252; font-size: 15px; line-height: 1.6; text-align: center;">
                      Obrigado por escolher o <strong>Corretor Studio</strong>!<br>
                      Estamos prontos para impulsionar seu processo comercial.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 8px 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
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

    return this.sendEmail({
      to: [data.userEmail],
      subject: 'Corretor Studio — Assinatura confirmada',
      html,
    });
  }

  // Notificação de novo lead para managers
  async sendLeadNotification(data: LeadNotificationData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Novo Lead Recebido!</h1>
        
        <p>Olá <strong>${data.managerName}</strong>,</p>
        
        <p>Um novo lead foi registrado em sua plataforma:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Dados do Lead:</h3>
          <p><strong>Nome:</strong> ${data.leadName}</p>
          <p><strong>Email:</strong> ${data.leadEmail}</p>
          ${data.leadPhone ? `<p><strong>Telefone:</strong> ${data.leadPhone}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver Lead no Dashboard
          </a>
        </div>
        
        <p>Entre na plataforma para visualizar e gerenciar este novo lead.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Este é um email automático do Corretor Studio.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [data.managerEmail],
      subject: `Novo Lead: ${data.leadName}`,
      html,
    });
  }

  // Email de convite para novo operador
  async sendOperatorInviteEmail(data: OperatorInviteEmailData) {
    const roleDescription: Record<string, string> = {
      'operator': 'Operador',
      'manager': 'Gerente',
    };

    const roleCapabilities: Record<string, string> = {
      'operator': `
        <h3 style="color: #333; margin-top: 20px;">Como Operador, você poderá:</h3>
        <ul style="color: #555; line-height: 1.8;">
          <li>✅ Gerenciar seus próprios leads</li>
          <li>✅ Acompanhar o funil de vendas</li>
          <li>✅ Visualizar métricas e estatísticas</li>
          <li>✅ Atualizar status de leads</li>
          <li>✅ Adicionar anotações e acompanhamentos</li>
          <li>✅ Fazer upload de documentos</li>
        </ul>
      `,
      'manager': `
        <h3 style="color: #333; margin-top: 20px;">Como Gerente, você poderá:</h3>
        <ul style="color: #555; line-height: 1.8;">
          <li>✅ Gerenciar todos os leads da equipe</li>
          <li>✅ Adicionar e gerenciar operadores</li>
          <li>✅ Acompanhar métricas da equipe</li>
          <li>✅ Distribuir leads entre operadores</li>
          <li>✅ Visualizar dashboards completos</li>
          <li>✅ Controlar assinaturas e pagamentos</li>
        </ul>
      `,
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🎉 Bem-vindo ao Corretor Studio!</h1>
        </div>
        
        <p style="font-size: 16px; color: #333;">Olá <strong>${data.operatorName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6;">
          Você foi convidado por <strong>${data.managerName}</strong> para fazer parte da equipe no <strong>Corretor Studio</strong>.
        </p>

        <div style="background-color: #f0f9ff; padding: 16px; border-left: 4px solid #2563eb; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">Sua função: ${roleDescription[data.operatorRole] || data.operatorRole}</p>
        </div>

        ${roleCapabilities[data.operatorRole] || ''}

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
          <h3 style="color: #333; margin-top: 0;">🚀 Por que usar o Corretor Studio?</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>📊 Dashboard com métricas em tempo real</li>
            <li>🎯 Funil de vendas visual e intuitivo</li>
            <li>📱 Interface responsiva para qualquer dispositivo</li>
            <li>🔔 Notificações automáticas de leads</li>
            <li>📎 Gestão de documentos anexados</li>
            <li>⚡ Atualizações instantâneas</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 40px 0;">
          <a href="${data.inviteUrl}" 
             style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
            🔐 Acessar Plataforma e Definir Senha
          </a>
        </div>

        <div style="background-color: #fef3c7; padding: 12px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            ⚠️ <strong>Importante:</strong> Este link expira em 24 horas. Clique no botão acima para definir sua senha e começar a usar a plataforma.
          </p>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Se você tiver alguma dúvida, entre em contato com <strong>${data.managerName}</strong> ou com o suporte do Corretor Studio.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center;">
          <p>Este é um email automático do Corretor Studio.</p>
          <p>Se você não esperava este convite, por favor ignore este email.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [data.operatorEmail],
      subject: `Convite: Você foi adicionado ao Corretor Studio por ${data.managerName}`,
      html,
    });
  }

  // Email de recuperação de senha
  async sendPasswordResetEmail(userEmail: string, userName: string, resetUrl: string) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Gestão Inteligente de Leads</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border-radius: 50%; border: 2px solid #ff6900; text-align: center; line-height: 72px; margin-bottom: 16px;">
                        <span style="font-size: 32px;">🔑</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Redefina sua Senha</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${userName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
                    </p>
                    
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🔐 Redefinir Senha
                      </a>
                    </div>

                    <!-- Aviso de Segurança -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>⚠️ Atenção:</strong> Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá inalterada.
                      </p>
                    </div>

                    <p style="margin: 16px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Este link é válido por <strong>1 hora</strong>.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
                    
                    <p style="margin: 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Precisa de ajuda? Estamos aqui para você! Entre em contato conosco a qualquer momento.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © 2026 Corretor Studio. Todos os direitos reservados.
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

    return this.sendEmail({
      to: [userEmail],
      subject: "Redefinição de Senha - Corretor Studio",
      html,
    });
  }
}

// Função para criar instância quando necessário
export function createEmailService() {
  return new EmailService();
}

// Export padrão que pode ser usado quando necessário
export const getEmailService = (() => {
  let instance: EmailService | null = null;
  return () => {
    if (!instance) {
      instance = new EmailService();
    }
    return instance;
  };
})();