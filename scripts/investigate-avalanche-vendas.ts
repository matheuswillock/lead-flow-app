#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Script de Investigação: Avalanche de Vendas Unipessoal Ltda
 * 
 * Objetivo: Análise completa de campanhas, dispatches, logs, eventos Radar
 * + identificar problemas similares aos de Multiskill e Katherein
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 INVESTIGAÇÃO: Avalanche de Vendas Unipessoal Ltda');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Buscar time Avalanche de Vendas
  console.log('📋 Buscando time Avalanche de Vendas...\n');

  const avalancheTeam = await prisma.team.findFirst({
    where: {
      name: { contains: 'Avalanche', mode: 'insensitive' },
    },
    include: {
      master: {
        select: { email: true },
      },
    },
  });

  if (!avalancheTeam) {
    console.error('❌ Time Avalanche de Vendas não encontrado!');
    process.exit(1);
  }

  console.log(`✅ Time encontrado: ${avalancheTeam.name}`);
  console.log(`   ID: ${avalancheTeam.id}`);
  console.log(`   Master: ${avalancheTeam.master?.email}\n`);

  // 2. Buscar todas as campanhas (product table)
  console.log('📧 Buscando todas as campanhas (product)...\n');

  const campaigns = await prisma.emailCampaign.findMany({
    where: { teamId: avalancheTeam.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 ${campaigns.length} campanhas encontradas\n`);

  // 3. Estatísticas gerais
  const campaignsWithFailures = campaigns.filter((c) => c.totalFailed > 0);
  const campaignsWithZeroOpen = campaigns.filter(
    (c) => c.totalDelivered > 0 && c.totalOpened === 0
  );
  const totalSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.totalDelivered, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.totalOpened, 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + c.totalClicked, 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + c.totalFailed, 0);

  console.log('📊 ESTATÍSTICAS GERAIS:');
  console.log(`   Total campanhas: ${campaigns.length}`);
  console.log(`   Campanhas com falhas: ${campaignsWithFailures.length}`);
  console.log(`   Campanhas com 0% abertura (mas entregues): ${campaignsWithZeroOpen.length}`);
  console.log(`   Total enviados: ${totalSent}`);
  console.log(`   Total entregues: ${totalDelivered}`);
  console.log(`   Total abertos: ${totalOpened} (${totalDelivered ? ((totalOpened / totalDelivered) * 100).toFixed(2) : 0}%)`);
  console.log(`   Total clicados: ${totalClicked} (${totalOpened ? ((totalClicked / totalOpened) * 100).toFixed(2) : 0}%)`);
  console.log(`   Total falhados: ${totalFailed}\n`);

  // 4. Analisar cada campanha
  for (const campaign of campaigns) {
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
    console.log(`   Failed: ${campaign.totalFailed}`);
    console.log(`   Parent Campaign: ${campaign.parentCampaignId || 'N/A'}`);
    
    if (campaign.errorMessage) {
      console.log(`   ⚠️  Campaign Error: ${campaign.errorMessage}`);
    }

    // Flag para campanhas suspeitas
    const isSuspicious = 
      (campaign.totalDelivered > 0 && campaign.totalOpened === 0) ||
      campaign.totalFailed > 0;
    
    if (isSuspicious) {
      console.log(`   🚨 CAMPANHA SUSPEITA`);
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
      console.log(`      │  Failed: ${dispatch.totalFailed}`);
      
      if (dispatch.errorMessage) {
        console.log(`      │  ⚠️  Dispatch Error: ${dispatch.errorMessage}`);
      }

      // 4.2 Sample de logs (primeiros 20)
      const logs = await prisma.emailLog.findMany({
        where: { dispatchId: dispatch.id },
        orderBy: { sentAt: 'asc' },
        take: 20,
      });

      if (logs.length > 0) {
        console.log(`      │  📝 Sample de logs (${logs.length} total, mostrando 20):`);

        // Análise de órfãos
        const orphans = logs.filter((log) => !log.resendEmailId && log.status !== 'failed');
        if (orphans.length > 0) {
          console.log(`      │     🚨 ${orphans.length} órfãos (sem resendEmailId)`);
        }

        // Análise de status
        const delivered = logs.filter((log) => log.status === 'delivered');
        const opened = logs.filter((log) => log.status === 'delivered' && log.openedAt);
        const clicked = logs.filter((log) => log.status === 'delivered' && log.clickedAt);
        const failed = logs.filter((log) => log.status === 'failed');

        console.log(`      │     Delivered: ${delivered.length}`);
        console.log(`      │     Opened: ${opened.length}`);
        console.log(`      │     Clicked: ${clicked.length}`);
        console.log(`      │     Failed: ${failed.length}`);

        // Sample de emails (primeiros 5)
        console.log(`      │     Sample (primeiros 5):`);
        logs.slice(0, 5).forEach((log, idx) => {
          console.log(`      │        [${idx + 1}] ${log.recipientEmail}`);
          console.log(`      │            Status: ${log.status}`);
          console.log(`      │            ResendID: ${log.resendEmailId || 'NULL'}`);
          console.log(`      │            Sent: ${log.sentAt?.toISOString() || 'N/A'}`);
          console.log(`      │            Delivered: ${log.deliveredAt?.toISOString() || 'N/A'}`);
          console.log(`      │            Opened: ${log.openedAt?.toISOString() || 'N/A'}`);
          if (log.status === 'failed') {
            console.log(`      │            Error: ${log.errorMessage || 'N/A'}`);
          }
        });

        // Patterns de erro (se houver falhas)
        if (failed.length > 0) {
          const errorPatterns = new Map<string, number>();
          logs
            .filter((log) => log.status === 'failed')
            .forEach((log) => {
              const error = log.errorMessage || 'UNKNOWN';
              errorPatterns.set(error, (errorPatterns.get(error) || 0) + 1);
            });

          console.log(`      │     📊 Patterns de erro:`);
          Array.from(errorPatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([error, count]) => {
              console.log(`      │        • ${error}: ${count}x`);
            });
        }
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
        events.slice(0, 5).forEach((event, idx) => {
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
        teamId: avalancheTeam.id,
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
      console.log(`      Sample (primeiros 5):`);
      emailAttributedLeads.slice(0, 5).forEach((lead, idx) => {
        console.log(`      [${idx + 1}] ${lead.name || 'N/A'} - ${lead.email || lead.phone || 'N/A'}`);
        console.log(`          ID: ${lead.id}`);
        console.log(`          Criado em: ${lead.createdAt.toISOString()}`);
        console.log(`          Status: ${lead.status}`);
      });
    }

    console.log('');
  }

  // 5. Análise de eventos Radar (últimos 7 dias)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Análise de Eventos Radar (últimos 7 dias)\n');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 5.1 Volume por tipo de evento
  const eventsByType = await prisma.$queryRaw<Array<{ eventType: string; count: bigint }>>`
    SELECT 
      re."eventType",
      COUNT(*) as count
    FROM "public"."corretor_studio_radar_events" re
    JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
    WHERE rp."teamId" = ${avalancheTeam.id}::uuid
      AND re."occurredAt" >= ${sevenDaysAgo}
    GROUP BY re."eventType"
    ORDER BY count DESC
  `;

  console.log('📈 Volume de eventos por tipo:');
  eventsByType.forEach((row) => {
    console.log(`   • ${row.eventType}: ${row.count.toString()} eventos`);
  });

  // 5.2 Eventos de email e formulário
  const emailFormEvents = await prisma.radarEvent.findMany({
    where: {
      profile: {
        teamId: avalancheTeam.id,
      },
      occurredAt: { gte: sevenDaysAgo },
      OR: [
        { eventType: { startsWith: 'email.' } },
        { eventType: { startsWith: 'form.' } },
      ],
    },
    include: {
      profile: {
        select: {
          normalizedPrimaryEmail: true,
          normalizedPhone: true,
        },
      },
    },
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });

  console.log(`\n📧 Eventos de email/formulário (${emailFormEvents.length} total, mostrando até 50):`);

  const eventTypeCount = new Map<string, number>();
  emailFormEvents.forEach((event) => {
    eventTypeCount.set(event.eventType, (eventTypeCount.get(event.eventType) || 0) + 1);
  });

  Array.from(eventTypeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}x`);
    });

  // 5.3 Eventos form.viewed/started sem lead correspondente
  console.log('\n🔍 Buscando eventos form.viewed/started sem lead associado...');

  const eventsWithoutLead = await prisma.$queryRaw<
    Array<{
      eventType: string;
      occurredAt: Date;
      normalizedPrimaryEmail: string | null;
      profileId: string;
      leadId: string | null;
    }>
  >`
    SELECT 
      re."eventType",
      re."occurredAt",
      rp."normalizedPrimaryEmail",
      rp.id as "profileId",
      l.id as "leadId"
    FROM "public"."corretor_studio_radar_events" re
    JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
    LEFT JOIN "public"."corretor_studio_radar_identities" ri 
      ON ri."profileId" = rp.id AND ri.type = 'lead_id'
    LEFT JOIN "public"."corretor_studio_leads" l 
      ON l.id::text = ri."normalizedValue" AND l."teamId" = rp."teamId"
    WHERE rp."teamId" = ${avalancheTeam.id}::uuid
      AND re."occurredAt" >= ${sevenDaysAgo}
      AND re."eventType" IN ('form.viewed', 'form.started', 'form.completed')
      AND l.id IS NULL
    ORDER BY re."occurredAt" DESC
    LIMIT 50
  `;

  console.log(`   📊 ${eventsWithoutLead.length} eventos de formulário sem lead associado`);

  if (eventsWithoutLead.length > 0) {
    console.log(`      Sample (primeiros 10):`);
    eventsWithoutLead.slice(0, 10).forEach((event, idx) => {
      console.log(`      [${idx + 1}] ${event.eventType}`);
      console.log(`          Occurred: ${event.occurredAt.toISOString()}`);
      console.log(`          Email: ${event.normalizedPrimaryEmail || 'N/A'}`);
      console.log(`          ProfileID: ${event.profileId.substring(0, 8)}...`);
    });
  }

  // 5.4 Leads fantasmas (criados recentemente sem submission)
  console.log('\n🔍 Buscando leads fantasmas (sem submission)...');

  const recentLeads = await prisma.lead.findMany({
    where: {
      teamId: avalancheTeam.id,
      originChannel: 'public_form',
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  const phantomLeadsWithoutSubmission = [];
  for (const lead of recentLeads) {
    const submission = await prisma.publicFormSubmission.findFirst({
      where: { leadId: lead.id },
    });

    if (!submission) {
      phantomLeadsWithoutSubmission.push(lead);
    }
  }

  console.log(`   📊 ${phantomLeadsWithoutSubmission.length} leads sem submission (possíveis fantasmas)`);

  if (phantomLeadsWithoutSubmission.length > 0) {
    console.log(`      Sample (primeiros 10):`);
    phantomLeadsWithoutSubmission.slice(0, 10).forEach((lead, idx) => {
      console.log(`      [${idx + 1}] ${lead.name || 'N/A'} - ${lead.email || lead.phone || 'N/A'}`);
      console.log(`          ID: ${lead.id}`);
      console.log(`          Criado em: ${lead.createdAt.toISOString()}`);
      console.log(`          Status: ${lead.status}`);
      const metadata = lead.originMetadata as any;
      console.log(`          Attribution: ${metadata?.attribution || 'N/A'}`);
    });
  }

  // 6. Resumo e Diagnóstico
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RESUMO E DIAGNÓSTICO\n');

  console.log('🔍 PROBLEMAS IDENTIFICADOS:');
  
  if (campaignsWithZeroOpen.length > 0) {
    console.log(`   ⚠️  ${campaignsWithZeroOpen.length} campanhas com 0% abertura (mas entregues)`);
  }
  
  if (campaignsWithFailures.length > 0) {
    console.log(`   ⚠️  ${campaignsWithFailures.length} campanhas com falhas`);
  }

  // Count total de órfãos em todas as campanhas
  const totalOrphansCount = await prisma.emailLog.count({
    where: {
      dispatch: {
        campaign: {
          teamId: avalancheTeam.id,
        },
      },
      resendEmailId: null,
      status: { not: 'failed' },
    },
  });

  if (totalOrphansCount > 0) {
    console.log(`   ⚠️  ${totalOrphansCount} logs órfãos (sem resendEmailId) em todas as campanhas`);
  }

  if (eventsWithoutLead.length > 0) {
    console.log(`   ⚠️  ${eventsWithoutLead.length} eventos de formulário sem lead associado`);
  }

  if (phantomLeadsWithoutSubmission.length > 0) {
    console.log(`   ⚠️  ${phantomLeadsWithoutSubmission.length} leads fantasmas sem submission`);
  }

  console.log('\n💡 RECOMENDAÇÕES:');
  console.log('   1. Investigar causa de campanhas com 0% abertura');
  console.log('   2. Revisar logs órfãos para identificar falhas de tracking');
  console.log('   3. Sincronizar eventos Radar com leads no CRM');
  console.log('   4. Auditar processo de criação de leads fantasmas');
  console.log('   5. Implementar monitoria de taxa de abertura em tempo real');

  console.log('\n═══════════════════════════════════════════════════');
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
