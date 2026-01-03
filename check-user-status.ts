import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserStatus() {
  try {
    // Buscar por e-mail similar
    const users = await prisma.profile.findMany({
      where: {
        OR: [
          { email: { contains: 'chffia', mode: 'insensitive' } },
          { email: { contains: 'Chffia', mode: 'insensitive' } },
          { fullName: { contains: 'chffia', mode: 'insensitive' } },
          { fullName: { contains: 'Chffia', mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        supabaseId: true,
        fullName: true,
        email: true,
        role: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        asaasCustomerId: true,
        asaasSubscriptionId: true,
        subscriptionStartDate: true,
        createdAt: true,
      }
    });

    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado com "Chffia" no nome ou e-mail\n');
      
      // Buscar últimos 5 usuários criados
      console.log('📋 Últimos 5 usuários cadastrados:\n');
      const latestUsers = await prisma.profile.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          fullName: true,
          email: true,
          subscriptionStatus: true,
          createdAt: true,
        }
      });
      
      console.table(latestUsers);
    } else {
      console.log(`✅ Encontrado(s) ${users.length} usuário(s):\n`);
      
      users.forEach((user, index) => {
        console.log(`\n--- Usuário ${index + 1} ---`);
        console.log(`Nome: ${user.fullName}`);
        console.log(`E-mail: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Status Assinatura: ${user.subscriptionStatus || 'NENHUM'}`);
        console.log(`Plano: ${user.subscriptionPlan || 'NENHUM'}`);
        console.log(`Asaas Customer ID: ${user.asaasCustomerId || 'NENHUM'}`);
        console.log(`Asaas Subscription ID: ${user.asaasSubscriptionId || 'NENHUM'}`);
        console.log(`Data Início Assinatura: ${user.subscriptionStartDate || 'NENHUMA'}`);
        console.log(`Data Cadastro: ${user.createdAt}`);
        console.log(`Supabase ID: ${user.supabaseId}`);
        
        // Análise do status
        console.log('\n📊 Análise:');
        if (!user.asaasCustomerId) {
          console.log('⚠️ Usuário NÃO tem Customer ID do Asaas - checkout não foi criado');
        } else if (!user.asaasSubscriptionId) {
          console.log('⚠️ Usuário tem Customer ID mas NÃO tem Subscription ID - checkout criado mas não pago');
        } else if (user.subscriptionStatus !== 'active') {
          console.log(`⚠️ Usuário tem Subscription mas status é "${user.subscriptionStatus}" - pagamento ainda não confirmado`);
          console.log('💡 E-mail de boas-vindas só é enviado quando status vira "active"');
        } else {
          console.log('✅ Assinatura ativa - e-mail deveria ter sido enviado');
          console.log('🔍 Verifique logs do servidor para erros no Resend');
        }
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserStatus();
