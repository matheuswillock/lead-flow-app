#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/ban-ts-comment -- one-off investigation script; schema fields may drift */
// @ts-nocheck
/* eslint-disable no-console */
/**
 * Script de Investigação: Campanhas Rede Dor (Time Multiskill)
 * 
 * Objetivo: Identificar por que tiveram entregabilidade mas zero taxa de abertura/clique
 * + erros de processamento + possível perda de leads
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CampaignSummary {
  id: string;
  name: string;
  createdAt: Date;
  scheduledAt: Date | null;
  status: string;
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  errorMessage: string | null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 INVESTIGAÇÃO: Campanhas Rede Dor (Multiskill)');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Buscar time Multiskill
  console.log('📋 Buscando time Multiskill...\n');
  
  const multiskillTeam = await prisma.team.findFirst({
    where: {
      OR: [
        { name: { contains: 'Multiskill', mode: 'insensitive' } },
        { name: { contains: 'Multi Skill', mode: 'insensitive' } },
      ],
    },
    include: {
      ownerProfile: {
        select: { email: true },
      },
    },
  });

  if (!multiskillTeam) {
    console.error('❌ Time Multiskill não encontrado!');
    process.exit(1);
  }

  console.log(`✅ Time encontrado: ${multiskillTeam.name}`);
  console.log(`   ID: ${multiskillTeam.id}`);
  console.log(`   Master: ${multiskillTeam.ownerProfile?.email}\n`);

  // 2. Buscar campanhas Rede Dor (product table)
  console.log('📧 Buscando campanhas "Rede Dor" (product)...\n');

  const productCampaigns = await prisma.emailCampaign.findMany({
    where: {
      teamId: multiskillTeam.id,
      name: { contains: 'Rede Dor', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 ${productCampaigns.length} campanhas encontradas (product table)\n`);

  // 3. Buscar campanhas Rede Dor (backoffice table)
  const backofficeCampaigns = await prisma.backofficeEmailCampaign.findMany({
    where: {
      name: { contains: 'Rede Dor', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 ${backofficeCampaigns.length} campanhas encontradas (backoffice table)\n`);

  // 4. Analisar cada campanha (product)
  for (const campaign of productCampaigns) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Campanha: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Criada em: ${campaign.createdAt.toISOString()}`);
    console.log(`   Agendada para: ${campaign.scheduledAt?.toISOString() || 'N/A'}`);
    console.log(`   Recipients: ${campaign.totalRecipients}`);
    console.log(`   Sent: ${campaign.totalSent}`);
    console.log(`   Delivered: ${campaign.totalDelivered}`);
    console.log(`   Opened: ${campaign.totalOpened} (${campaign.totalDelivered ? ((campaign.totalOpened / campaign.totalDelivered) * 100).toFixed(2) : 0}%)`);
    console.log(`   Clicked: ${campaign.totalClicked} (${campaign.totalOpened ? ((campaign.totalClicked / campaign.totalOpened) * 100).toFixed(2) : 0}%)`);
    console.log(`   Bounced: ${campaign.totalBounced}`);
    if (campaign.errorMessage) {
      console.log(`   ⚠️  Error: ${campaign.errorMessage}`);
    }

    // 4.1 Buscar dispatches
    const dispatches = await prisma.emailCampaignDispatch.findMany({
      where: { campaignId: campaign.id },
      orderBy: { dispatchedAt: 'asc' },
    });

    console.log(`\n   📦 Dispatches: ${dispatches.length}`);

    for (const dispatch of dispatches) {
      console.log(`      ├─ Dispatch ${dispatch.id.substring(0, 8)}...`);
      console.log(`      │  Status: ${dispatch.status}`);
      console.log(`      │  Dispatched: ${dispatch.dispatchedAt?.toISOString() || 'N/A'}`);
      console.log(`      │  Recipients: ${dispatch.totalRecipients}`);
      console.log(`      │  Sent: ${dispatch.totalSent}`);
      if (dispatch.errorMessage) {
        console.log(`      │  ⚠️  Error: ${dispatch.errorMessage}`);
      }

      // 4.2 Sample de logs (primeiros 10)
      const logs = await prisma.emailLog.findMany({
        where: { dispatchId: dispatch.id },
        orderBy: { sentAt: 'asc' },
        take: 10,
      });

      if (logs.length > 0) {
        console.log(`      │  📝 Sample de logs (${logs.length}):`);
        
        const orphans = logs.filter((log) => !log.resendEmailId && log.status !== 'failed');
        if (orphans.length > 0) {
          console.log(`      │     ⚠️  ${orphans.length} órfãos (sem resendEmailId)`);
        }

        const delivered = logs.filter((log) => log.status === 'delivered');
        const opened = logs.filter((log) => log.status === 'delivered' && log.openedAt);
        const clicked = logs.filter((log) => log.status === 'delivered' && log.clickedAt);

        console.log(`      │     Delivered: ${delivered.length}`);
        console.log(`      │     Opened: ${opened.length}`);
        console.log(`      │     Clicked: ${clicked.length}`);

        // Sample de 3 emails
        logs.slice(0, 3).forEach((log, idx) => {
          console.log(`      │     [${idx + 1}] ${log.recipientEmail}`);
          console.log(`      │         Status: ${log.status}`);
          console.log(`      │         ResendID: ${log.resendEmailId || 'NULL'}`);
          console.log(`      │         Sent: ${log.sentAt?.toISOString() || 'N/A'}`);
          console.log(`      │         Delivered: ${log.deliveredAt?.toISOString() || 'N/A'}`);
          console.log(`      │         Opened: ${log.openedAt?.toISOString() || 'N/A'}`);
        });
      }

      // 4.3 Count total de órfãos no dispatch
      const totalOrphans = await prisma.emailLog.count({
        where: {
          dispatchId: dispatch.id,
          resendEmailId: null,
          status: { not: 'failed' },
        },
      });

      if (totalOrphans > 0) {
        console.log(`      │  🚨 TOTAL DE ÓRFÃOS: ${totalOrphans}`);
      }

      // 4.4 Sample de eventos de webhook
      const events = await prisma.emailEvent.findMany({
        where: {
          log: {
            dispatchId: dispatch.id,
          },
        },
        include: {
          log: {
            select: { recipientEmail: true, resendEmailId: true },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      });

      if (events.length > 0) {
        console.log(`      │  📬 Sample de eventos de webhook (${events.length}):`);
        events.slice(0, 3).forEach((event, idx) => {
          console.log(`      │     [${idx + 1}] ${event.type}`);
          console.log(`      │         Email: ${event.log?.recipientEmail}`);
          console.log(`      │         Occurred: ${event.occurredAt.toISOString()}`);
          console.log(`      │         ResendID: ${event.log?.resendEmailId || 'NULL'}`);
        });
      }
    }

    // 4.5 Buscar leads criados a partir dessa campanha
    const campaignStart = campaign.scheduledAt || campaign.createdAt;
    const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias

    const leads = await prisma.lead.findMany({
      where: {
        teamId: multiskillTeam.id,
        originChannel: 'public_form',
        createdAt: {
          gte: campaignStart,
          lte: campaignEnd,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const emailAttributedLeads = leads.filter((lead) => {
      const metadata = lead.originMetadata as any;
      return metadata?.attribution === 'email_campaign';
    });

    console.log(`\n   👤 Leads criados (janela de 7 dias): ${leads.length}`);
    console.log(`   👤 Leads atribuídos a email: ${emailAttributedLeads.length}`);

    if (emailAttributedLeads.length > 0) {
      console.log(`      Sample (primeiros 3):`);
      emailAttributedLeads.slice(0, 3).forEach((lead, idx) => {
        console.log(`      [${idx + 1}] ${lead.name || 'N/A'} - ${lead.email || lead.phone || 'N/A'}`);
        console.log(`          Criado em: ${lead.createdAt.toISOString()}`);
        console.log(`          Status: ${lead.status}`);
      });
    }

    console.log('');
  }

  // 5. Análise de backofficeCampaigns (se houver)
  if (backofficeCampaigns.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Campanhas Backoffice (Rede Dor):\n');

    for (const campaign of backofficeCampaigns) {
      console.log(`   • ${campaign.name}`);
      console.log(`     ID: ${campaign.id}`);
      console.log(`     Status: ${campaign.status}`);
      console.log(`     Sent: ${campaign.totalSent} / Delivered: ${campaign.totalDelivered}`);
      console.log(`     Opened: ${campaign.totalOpened} / Clicked: ${campaign.totalClicked}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Investigação completa!');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((error) => {
    console.error('❌ Erro na investigação:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
