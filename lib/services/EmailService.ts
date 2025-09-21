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

export class EmailService {
  private resend;

  constructor() {
    this.resend = assertResend();
  }

  // Método genérico para enviar emails
  async sendEmail(options: EmailOptions) {
    try {
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

      const result = await this.resend.emails.send(emailData);
      return { success: true, data: result };
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      return { success: false, error: error.message };
    }
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

// Instância singleton
export const emailService = new EmailService();