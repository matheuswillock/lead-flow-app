import { PrismaClient } from '@prisma/client';
import { getEmailService } from './lib/services/EmailService';

const prisma = new PrismaClient();

async function resendWelcomeEmail(emailOrName: string) {
  try {
    console.info(`🔍 Buscando usuário: ${emailOrName}...\n`);

    const user = await prisma.profile.findFirst({
      where: {
        OR: [
          { email: { contains: emailOrName, mode: 'insensitive' } },
          { fullName: { contains: emailOrName, mode: 'insensitive' } },
        ]
      }
    });

    if (!user) {
      console.info('❌ Usuário não encontrado\n');
      return;
    }

    console.info('✅ Usuário encontrado:');
    console.info(`   Nome: ${user.fullName}`);
    console.info(`   E-mail: ${user.email}`);
    console.info(`   Status: ${user.subscriptionStatus || 'pending'}\n`);

    // Enviar e-mail de boas-vindas
    const emailService = getEmailService();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const loginUrl = `${appUrl}/sign-in`;

    console.info('📧 Enviando e-mail de boas-vindas...\n');

    const result = await emailService.sendWelcomeEmail({
      userName: user.fullName || user.email,
      userEmail: user.email,
      loginUrl,
    });

    if (result.success) {
      console.info('✅ E-mail enviado com sucesso!');
      console.info('📨 ID do e-mail:', result.data);
    } else {
      console.info('❌ Erro ao enviar e-mail:');
      console.info('   ', result.error);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
const searchTerm = process.argv[2] || 'Chffia';
resendWelcomeEmail(searchTerm);
