#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Script de Investigação: Campanhas Katherein
 * 
 * Objetivo: Identificar por que o botão "Reenviar apenas falhas" retorna erro interno
 * + análise de logs e eventos Radar
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 INVESTIGAÇÃO: Campanhas Katherein');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Buscar time Katherein
  console.log('📋 Buscando time Katherein...\n');

  const kathereinTeam = await prisma.team.findFirst({
    where: {
      OR: [
        {
          ownerProfile: {
            email: { contains: 'katherein', mode: 'insensitive' },
          },
        },
        { name: { contains: 'katherein', mode: 'insensitive' } },
      ],
    },
    include: {
      ownerProfile: {
        select: { email: true },
      },
    },
  });

  if (!kathereinTeam) {
    console.error('❌ Time Katherein não encontrado!');
    process.exit(1);
  }

  console.log(`✅ Time encontrado: ${kathereinTeam.name}`);
  console.log(`   ID: ${kathereinTeam.id}`);
  console.log(`   Master: ${kathereinTeam.ownerProfile?.email}\n`);

  // 2. Buscar todas as campanhas
  console.log('📧 Buscando campanhas desde o primeiro envio...\n');

  const campaigns = await prisma.emailCampaign.findMany({
    where: { teamId: kathereinTeam.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 ${campaigns.length} campanhas encontradas\n`);

  // 3. Campanhas com falhas
  const campaignsWithFailures = campaigns.filter((c) => c.totalFailed > 0);
  console.log(`🚨 ${campaignsWithFailures.length} campanhas com falhas\n`);

  // 4. Analisar cada campanha com falhas
  for (const campaign of campaignsWithFailures) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Campanha: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Criada em: ${campaign.createdAt.toISOString()}`);
    console.log(`   Recipients: ${campaign.totalRecipients}`);
    console.log(`   Sent: ${campaign.totalSent}`);
    console.log(`   Failed: ${campaign.totalFailed} 🚨`);
    console.log(`   Parent Campaign: ${campaign.parentCampaignId || 'N/A'}`);
    if (campaign.errorMessage) {
      console.log(`   ⚠️  Campaign Error: ${campaign.errorMessage}`);
    }

    // 4.1 Dispatches com falhas
    const dispatches = await prisma.emailCampaignDispatch.findMany({
      where: {
        campaignId: campaign.id,
        OR: [
          { totalFailed: { gt: 0 } },
          { status: 'failed' },
        ],
      },
      orderBy: { dispatchedAt: 'desc' },
    });

    console.log(`\n   📦 Dispatches com falhas: ${dispatches.length}`);

    for (const dispatch of dispatches) {
      console.log(`      ├─ Dispatch ${dispatch.id.substring(0, 8)}...`);
      console.log(`      │  Status: ${dispatch.status}`);
      console.log(`      │  Dispatched: ${dispatch.dispatchedAt?.toISOString() || 'N/A'}`);
      console.log(`      │  Recipients: ${dispatch.totalRecipients}`);
      console.log(`      │  Sent: ${dispatch.totalSent}`);
      console.log(`      │  Failed: ${dispatch.totalFailed} 🚨`);
      if (dispatch.errorMessage) {
        console.log(`      │  ⚠️  Dispatch Error: ${dispatch.errorMessage}`);
      }

      // 4.2 Logs com falha
      const failedLogs = await prisma.emailLog.findMany({
        where: {
          dispatchId: dispatch.id,
          status: 'failed',
        },
        orderBy: { failedAt: 'desc' },
        take: 10,
      });

      if (failedLogs.length > 0) {
        console.log(`      │  📝 Logs com falha (${failedLogs.length} total, mostrando 10):`);

        // Pattern de erro
        const errorPatterns = new Map<string, number>();
        for (const log of failedLogs) {
          const error = log.errorMessage || 'UNKNOWN';
          errorPatterns.set(error, (errorPatterns.get(error) || 0) + 1);
        }

        console.log(`      │     📊 Patterns de erro:`);
        Array.from(errorPatterns.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([error, count]) => {
            console.log(`      │        • ${error}: ${count}x`);
          });

        // Sample de logs
        console.log(`      │     Sample (primeiros 3):`);
        failedLogs.slice(0, 3).forEach((log, idx) => {
          console.log(`      │        [${idx + 1}] ${log.recipientEmail}`);
          console.log(`      │            Sent: ${log.sentAt?.toISOString() || 'N/A'}`);
          console.log(`      │            Failed: ${log.failedAt?.toISOString() || 'N/A'}`);
          console.log(`      │            Error: ${log.errorMessage || 'N/A'}`);
        });
      }
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
    WHERE rp."teamId" = ${kathereinTeam.id}
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
      corretor_studio_radar_profiles: {
        teamId: kathereinTeam.id,
      },
      occurredAt: { gte: sevenDaysAgo },
      OR: [
        { eventType: { startsWith: 'email.' } },
        { eventType: { startsWith: 'form.' } },
      ],
    },
    include: {
      corretor_studio_radar_profiles: {
        select: {
          normalizedEmail: true,
          normalizedPhone: true,
        },
      },
    },
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });

  console.log(`\n📧 Eventos de email/formulário (${emailFormEvents.length} total, mostrando 50):`);

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
      normalizedEmail: string | null;
      profileId: string;
      leadId: string | null;
    }>
  >`
    SELECT 
      re."eventType",
      re."occurredAt",
      rp."normalizedEmail",
      rp.id as "profileId",
      l.id as "leadId"
    FROM "public"."corretor_studio_radar_events" re
    JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
    LEFT JOIN "public"."corretor_studio_radar_identities" ri 
      ON ri."profileId" = rp.id AND ri.type = 'lead_id'
    LEFT JOIN "public"."corretor_studio_leads" l 
      ON l.id::text = ri."normalizedValue" AND l."teamId" = rp."teamId"
    WHERE rp."teamId" = ${kathereinTeam.id}
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
      console.log(`          Email: ${event.normalizedEmail || 'N/A'}`);
      console.log(`          ProfileID: ${event.profileId.substring(0, 8)}...`);
    });
  }

  // 5.4 Leads fantasmas (Fase E)
  console.log('\n🔍 Buscando leads fantasmas (criados por form.viewed)...');

  const phantomLeads = await prisma.lead.findMany({
    where: {
      teamId: kathereinTeam.id,
      originChannel: 'public_form',
      createdAt: { gte: new Date('2026-08-05') }, // data do incidente
    },
    orderBy: { createdAt: 'desc' },
  });

  const phantomLeadsWithoutSubmission = [];
  for (const lead of phantomLeads) {
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
