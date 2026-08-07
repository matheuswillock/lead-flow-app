#!/usr/bin/env tsx
/* eslint-disable no-console */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const CAMPAIGN_ID = '8000b454-0ecc-4292-bdf7-2dad9cc8ed65'; // Empresa Consolidada 06
  
  console.log('🔍 Buscando campanha Empresa Consolidada 06...\n');

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: CAMPAIGN_ID },
    select: {
      id: true,
      name: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!campaign) {
    console.error('❌ Campanha não encontrada!');
    return;
  }

  console.log('📧 Campanha encontrada:');
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Nome: ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Agendada para: ${campaign.scheduledAt || 'Não agendada'}`);
  console.log();

  // Check if campaign is ready to be sent
  if (campaign.status !== 'draft') {
    console.log(`⚠️  Campanha não está em draft (status: ${campaign.status})`);
    console.log('   Para redisparar, precisa estar em "draft"');
    return;
  }

  // Schedule campaign for immediate dispatch
  const now = new Date();
  now.setSeconds(now.getSeconds() + 30); // 30 seconds from now

  console.log(`📅 Agendando campanha para: ${now.toISOString()}`);
  
  const updated = await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      scheduledAt: now,
      status: 'scheduled'
    },
    select: {
      id: true,
      name: true,
      status: true,
      scheduledAt: true
    }
  });

  console.log();
  console.log('✅ Campanha agendada com sucesso!');
  console.log(`   Status: ${updated.status}`);
  console.log(`   Agendada para: ${updated.scheduledAt}`);
  console.log();
  console.log('🔔 O cron job irá processar a campanha em breve.');
  console.log('   Monitore os logs para acompanhar o envio.');
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
