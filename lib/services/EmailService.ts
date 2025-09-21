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

export interface UserInviteEmailData {
  userName: string;
  userEmail: string;
  inviterName: string;
  confirmationUrl: string;
  token: string;
}

export interface LeadNotificationData {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  managerName: string;
  managerEmail: string;
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
      
      const emailData: any = {
        from: options.from || "Lead Flow <noreply@leadflow.com>",
        to: options.to,
        subject: options.subject,
      };

      if (options.html) {
        emailData.html = options.html;
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

  // Email de convite para novos usuários
  async sendUserInviteEmail(data: UserInviteEmailData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin-bottom: 10px;">Bem-vindo ao Lead Flow!</h1>
            <div style="width: 50px; height: 3px; background-color: #007bff; margin: 0 auto;"></div>
          </div>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Olá <strong>${data.userName}</strong>,</p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Você foi convidado por <strong>${data.inviterName}</strong> para fazer parte da equipe no Lead Flow, 
            nossa plataforma de gestão de leads para corretores de planos de saúde.
          </p>
          
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #2196f3;">
            <h3 style="margin-top: 0; color: #1976d2; font-size: 18px;">🎯 O que você pode fazer:</h3>
            <ul style="color: #666; margin: 10px 0; padding-left: 20px;">
              <li>Gerenciar leads de forma eficiente</li>
              <li>Acompanhar o pipeline de vendas</li>
              <li>Colaborar com sua equipe em tempo real</li>
              <li>Visualizar métricas e relatórios detalhados</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Para começar, clique no botão abaixo para ativar sua conta e criar sua senha:
          </p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${data.confirmationUrl}" 
               style="background-color: #007bff; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,123,255,0.3);">
              ✨ Ativar Minha Conta
            </a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Este link de ativação expira em 24 horas por motivos de segurança.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            Se você não conseguir clicar no botão, copie e cole este link no seu navegador:<br>
            <a href="${data.confirmationUrl}" style="color: #007bff; word-break: break-all;">${data.confirmationUrl}</a>
          </p>
          
          <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              Este é um email automático do Lead Flow. Se você não esperava receber este convite, pode ignorar este email.
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Bem-vindo ao Lead Flow!

Olá ${data.userName},

Você foi convidado por ${data.inviterName} para fazer parte da equipe no Lead Flow.

Para ativar sua conta, acesse: ${data.confirmationUrl}

Este link expira em 24 horas.

Se você não esperava receber este convite, pode ignorar este email.
    `;

    return this.sendEmail({
      to: [data.userEmail],
      subject: `🎯 Convite para Lead Flow - Ative sua conta agora!`,
      html,
      text,
    });
  }

  // Email de boas-vindas para novos usuários
  async sendWelcomeEmail(data: WelcomeEmailData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; text-align: center;">Bem-vindo ao Lead Flow!</h1>
        
        <p>Olá <strong>${data.userName}</strong>,</p>
        
        <p>Sua conta foi criada com sucesso no Lead Flow. Agora você pode começar a gerenciar seus leads de forma eficiente.</p>
        
        ${data.loginUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Acessar Plataforma
            </a>
          </div>
        ` : ''}
        
        <p>Se você tiver alguma dúvida, não hesite em entrar em contato conosco.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Este é um email automático do Lead Flow.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [data.userEmail],
      subject: "Bem-vindo ao Lead Flow - Sua conta foi criada!",
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
          <p>Este é um email automático do Lead Flow.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [data.managerEmail],
      subject: `Novo Lead: ${data.leadName}`,
      html,
    });
  }

  // Email de recuperação de senha
  async sendPasswordResetEmail(userEmail: string, userName: string, resetUrl: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Redefinição de Senha</h1>
        
        <p>Olá <strong>${userName}</strong>,</p>
        
        <p>Você solicitou a redefinição de sua senha no Lead Flow.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Redefinir Senha
          </a>
        </div>
        
        <p><strong>Importante:</strong> Este link expira em 24 horas por motivos de segurança.</p>
        
        <p>Se você não solicitou esta redefinição, ignore este email.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Este é um email automático do Lead Flow.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [userEmail],
      subject: "Redefinição de Senha - Lead Flow",
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