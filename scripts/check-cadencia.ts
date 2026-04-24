import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCadencia() {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        manager: {
          supabaseId: 'd41b5b47-9e3c-4eae-9eb6-798129c741c4'
        }
      },
      select: {
        id: true,
        name: true,
        currentValue: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.info('\n📊 Leads encontrados:', leads.length);
    console.info('\n📝 Detalhes dos leads:');
    leads.forEach(lead => {
      console.info(`- ${lead.name}: R$ ${lead.currentValue || 0} (Status: ${lead.status})`);
    });

    const totalCadencia = leads.reduce((total, lead) => total + Number(lead.currentValue || 0), 0);
    console.info(`\n💰 Total Cadência: R$ ${totalCadencia}`);
    console.info(`💰 Formatado: R$ ${totalCadencia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCadencia();
