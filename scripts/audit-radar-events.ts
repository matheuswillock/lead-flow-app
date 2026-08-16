#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/ban-ts-comment -- one-off investigation script; schema fields may drift */
// @ts-nocheck
/* eslint-disable no-console */
/**
 * Script de Auditoria: Eventos Radar (3 Times)
 * 
 * Objetivo: Auditar volume, gaps, performance e eventos perdidos
 * Times: Katherein, Multiskill, Avalanche de Vendas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 AUDITORIA: Eventos Radar (3 Times)');
  console.log('═══════════════════════════════════════════════════\n');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Buscar os 3 times
  console.log('📋 Buscando times...\n');

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { name: { contains: 'Katherein', mode: 'insensitive' } },
        { name: { contains: 'MultiSkill', mode: 'insensitive' } },
        { name: { contains: 'Multi Skill', mode: 'insensitive' } },
        { name: { contains: 'Avalanche', mode: 'insensitive' } },
      ],
    },
    include: {
      ownerProfile: {
        select: { email: true },
      },
    },
  });

  console.log(`✅ ${teams.length} times encontrados:`);
  teams.forEach((team) => {
    console.log(`   • ${team.name} (${team.id})`);
  });
  console.log('');

  // 2. Análise de performance e falhas por time
  for (const team of teams) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 ANÁLISE: ${team.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 2.1 Volume de eventos por tipo (últimos 7 dias)
    const eventsByType = await prisma.$queryRaw<
      Array<{
        eventType: string;
        total_events: bigint;
        first_event: Date;
        last_event: Date;
      }>
    >`
      SELECT 
        re."eventType",
        COUNT(*) as total_events,
        MIN(re."occurredAt") as first_event,
        MAX(re."occurredAt") as last_event
      FROM "public"."corretor_studio_radar_events" re
      JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}
        AND re."occurredAt" >= ${sevenDaysAgo}
      GROUP BY re."eventType"
      ORDER BY total_events DESC
    `;

    console.log('📈 Volume de eventos por tipo (últimos 7 dias):');
    if (eventsByType.length === 0) {
      console.log('   ⚠️  Nenhum evento encontrado\n');
    } else {
      eventsByType.forEach((row) => {
        console.log(`   • ${row.eventType}: ${row.total_events.toString()} eventos`);
        console.log(`     Primeira ocorrência: ${row.first_event.toISOString()}`);
        console.log(`     Última ocorrência: ${row.last_event.toISOString()}`);
      });
      console.log('');
    }

    // 2.2 Engagement score distribution
    const scoreDistribution = await prisma.$queryRaw<
      Array<{
        temperatura: string;
        profile_count: bigint;
        avg_score: number;
      }>
    >`
      SELECT 
        CASE 
          WHEN rp."engagementScore" >= 75 THEN 'Quente (75-100)'
          WHEN rp."engagementScore" >= 50 THEN 'Morno (50-74)'
          WHEN rp."engagementScore" >= 25 THEN 'Frio (25-49)'
          ELSE 'Congelado (0-24)'
        END as temperatura,
        COUNT(*) as profile_count,
        AVG(rp."engagementScore") as avg_score
      FROM "public"."corretor_studio_radar_profiles" rp
      WHERE rp."teamId" = ${team.id}
      GROUP BY temperatura
      ORDER BY avg_score DESC
    `;

    console.log('🌡️  Distribuição de Engagement Score:');
    if (scoreDistribution.length === 0) {
      console.log('   ⚠️  Nenhum perfil encontrado\n');
    } else {
      scoreDistribution.forEach((row) => {
        console.log(`   • ${row.temperatura}: ${row.profile_count.toString()} perfis (avg: ${row.avg_score.toFixed(2)})`);
      });
      console.log('');
    }

    // 2.3 Emails enviados vs. eventos Radar
    const emailsSent = await prisma.$queryRaw<Array<{ emails_sent: bigint }>>`
      SELECT 
        COUNT(DISTINCT el.id) as emails_sent
      FROM "public"."corretor_studio_email_logs" el
      JOIN "public"."corretor_studio_email_campaign_dispatches" ecd ON el."dispatchId" = ecd.id
      JOIN "public"."corretor_studio_email_campaigns" ec ON ecd."campaignId" = ec.id
      WHERE ec."teamId" = ${team.id}
        AND el."sentAt" >= ${sevenDaysAgo}
        AND el."status" != 'failed'
    `;

    const radarEmailEvents = await prisma.$queryRaw<Array<{ radar_email_events: bigint }>>`
      SELECT 
        COUNT(*) as radar_email_events
      FROM "public"."corretor_studio_radar_events" re
      JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}
        AND re."occurredAt" >= ${sevenDaysAgo}
        AND re."eventType" LIKE 'email.%'
    `;

    const sentCount = Number(emailsSent[0]?.emails_sent || 0);
    const radarCount = Number(radarEmailEvents[0]?.radar_email_events || 0);
    const gap = sentCount - radarCount;
    const gapPercentage = sentCount > 0 ? ((gap / sentCount) * 100).toFixed(2) : '0.00';

    console.log('📧 Emails Enviados vs. Eventos Radar:');
    console.log(`   • Emails enviados: ${sentCount}`);
    console.log(`   • Eventos Radar (email.*): ${radarCount}`);
    console.log(`   • Gap (eventos perdidos): ${gap} (${gapPercentage}%)`);
    if (gap > 0) {
      console.log(`   🚨 ATENÇÃO: ${gap} eventos de email podem ter sido perdidos!`);
    }
    console.log('');

    // 2.4 Leads criados vs. eventos lead.created
    const leadsCreated = await prisma.$queryRaw<Array<{ leads_created: bigint }>>`
      SELECT 
        COUNT(*) as leads_created
      FROM "public"."corretor_studio_leads" l
      WHERE l."teamId" = ${team.id}
        AND l."createdAt" >= ${sevenDaysAgo}
        AND l."deletedAt" IS NULL
    `;

    const radarLeadEvents = await prisma.$queryRaw<Array<{ radar_lead_events: bigint }>>`
      SELECT 
        COUNT(*) as radar_lead_events
      FROM "public"."corretor_studio_radar_events" re
      JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}
        AND re."occurredAt" >= ${sevenDaysAgo}
        AND re."eventType" = 'lead.created'
    `;

    const createdCount = Number(leadsCreated[0]?.leads_created || 0);
    const radarLeadCount = Number(radarLeadEvents[0]?.radar_lead_events || 0);
    const leadGap = createdCount - radarLeadCount;
    const leadGapPercentage = createdCount > 0 ? ((leadGap / createdCount) * 100).toFixed(2) : '0.00';

    console.log('👤 Leads Criados vs. Eventos lead.created:');
    console.log(`   • Leads criados: ${createdCount}`);
    console.log(`   • Eventos Radar (lead.created): ${radarLeadCount}`);
    console.log(`   • Gap (eventos perdidos): ${leadGap} (${leadGapPercentage}%)`);
    if (leadGap > 0) {
      console.log(`   🚨 ATENÇÃO: ${leadGap} eventos de lead podem ter sido perdidos!`);
    }
    console.log('');

    // 2.5 Eventos de sync manual/backfill
    const syncEvents = await prisma.$queryRaw<
      Array<{
        sourceType: string;
        event_count: bigint;
        first_sync: Date;
        last_sync: Date;
      }>
    >`
      SELECT 
        re."sourceType",
        COUNT(*) as event_count,
        MIN(re."occurredAt") as first_sync,
        MAX(re."occurredAt") as last_sync
      FROM "public"."corretor_studio_radar_events" re
      JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}
        AND re."occurredAt" >= ${sevenDaysAgo}
        AND re."sourceType" IN ('crm_sync', 'email_sync', 'whatsapp_sync', 'portfolio_sync')
      GROUP BY re."sourceType"
      ORDER BY event_count DESC
    `;

    if (syncEvents.length > 0) {
      console.log('🔄 Eventos de sync manual/backfill:');
      syncEvents.forEach((row) => {
        console.log(`   • ${row.sourceType}: ${row.event_count.toString()} eventos`);
        console.log(`     Primeiro: ${row.first_sync.toISOString()}`);
        console.log(`     Último: ${row.last_sync.toISOString()}`);
      });
      console.log('');
    }
  }

  // 3. Resumo geral
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMO GERAL (Todos os Times)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const teamIds = teams.map((t) => t.id);

  const totalEvents = await prisma.radarEvent.count({
    where: {
      corretor_studio_radar_profiles: {
        teamId: { in: teamIds },
      },
      occurredAt: { gte: sevenDaysAgo },
    },
  });

  const totalProfiles = await prisma.radarProfile.count({
    where: {
      teamId: { in: teamIds },
    },
  });

  const totalEmailsSent = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(DISTINCT el.id) as total
    FROM "public"."corretor_studio_email_logs" el
    JOIN "public"."corretor_studio_email_campaign_dispatches" ecd ON el."dispatchId" = ecd.id
    JOIN "public"."corretor_studio_email_campaigns" ec ON ecd."campaignId" = ec.id
    WHERE ec."teamId" = ANY(${teamIds}::uuid[])
      AND el."sentAt" >= ${sevenDaysAgo}
      AND el."status" != 'failed'
  `;

  const totalRadarEmailEvents = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) as total
    FROM "public"."corretor_studio_radar_events" re
    JOIN "public"."corretor_studio_radar_profiles" rp ON re."profileId" = rp.id
    WHERE rp."teamId" = ANY(${teamIds}::uuid[])
      AND re."occurredAt" >= ${sevenDaysAgo}
      AND re."eventType" LIKE 'email.%'
  `;

  const totalSent = Number(totalEmailsSent[0]?.total || 0);
  const totalRadar = Number(totalRadarEmailEvents[0]?.total || 0);
  const totalGap = totalSent - totalRadar;
  const totalGapPercentage = totalSent > 0 ? ((totalGap / totalSent) * 100).toFixed(2) : '0.00';

  console.log('📈 Métricas Consolidadas:');
  console.log(`   • Total de eventos Radar: ${totalEvents}`);
  console.log(`   • Total de perfis Radar: ${totalProfiles}`);
  console.log(`   • Emails enviados (total): ${totalSent}`);
  console.log(`   • Eventos Radar email.* (total): ${totalRadar}`);
  console.log(`   • Gap geral: ${totalGap} (${totalGapPercentage}%)`);

  if (totalGap > 0) {
    console.log(`\n   🚨 CONCLUSÃO: ${totalGap} eventos de email podem ter sido perdidos inline!`);
    console.log(`      Recomendação: Implementar fila Redis/Upstash para processamento assíncrono`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Auditoria completa!');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((error) => {
    console.error('❌ Erro na auditoria:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
