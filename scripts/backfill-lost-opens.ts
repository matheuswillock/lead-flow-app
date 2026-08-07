#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/ban-ts-comment -- one-off investigation script; schema fields may drift */
// @ts-nocheck
/* eslint-disable no-console */
/**
 * Script de Backfill: Eventos de Abertura Perdidos
 * 
 * Objetivo: Recuperar os 46 eventos de abertura que existem no Radar
 * mas não foram propagados para os Email Logs das campanhas Rede Dor
 * 
 * Time afetado: Multiskill (7b577c22-5513-42cc-ab19-2bf867e14ebc)
 * Período: 2026-08-06 em diante
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MULTISKILL_TEAM_ID = '7b577c22-5513-42cc-ab19-2bf867e14ebc';
const START_DATE = new Date('2026-08-06T00:00:00Z');

interface RadarEventWithProfile {
  id: string;
  eventType: string;
  occurredAt: Date;
  metadata: any;
  profile: {
    teamId: string;
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔧 BACKFILL: Eventos de Abertura Perdidos');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Buscar eventos de abertura no Radar que não têm correspondente nos logs
  console.log('📊 Buscando eventos de abertura perdidos...\n');

  const lostOpenEvents = await prisma.$queryRaw<
    Array<{
      radar_event_id: string;
      occurred_at: Date;
      resend_email_id: string;
      recipient_email: string;
    }>
  >`
    SELECT 
      re.id as radar_event_id,
      re."occurredAt" as occurred_at,
      re.metadata->>'emailId' as resend_email_id,
      re.metadata->>'recipient' as recipient_email
    FROM corretor_studio_radar_events re
    JOIN corretor_studio_radar_profiles rp ON re."profileId" = rp.id
    WHERE rp."teamId" = ${MULTISKILL_TEAM_ID}::uuid
      AND re."occurredAt" >= ${START_DATE}
      AND re."eventType" = 'email.opened'
      AND re.metadata->>'emailId' IS NOT NULL
  `;

  console.log(`✅ ${lostOpenEvents.length} eventos de abertura encontrados no Radar\n`);

  if (lostOpenEvents.length === 0) {
    console.log('✅ Nenhum evento perdido! Sistema está sincronizado.\n');
    return;
  }

  // 2. Para cada evento, verificar se já existe no log
  let alreadySynced = 0;
  let needsBackfill = 0;
  const eventsToBackfill: typeof lostOpenEvents = [];

  console.log('🔍 Verificando quais eventos precisam de backfill...\n');

  for (const event of lostOpenEvents) {
    const existingLog = await prisma.emailLog.findFirst({
      where: {
        resendEmailId: event.resend_email_id,
        openedAt: { not: null },
      },
    });

    if (existingLog) {
      alreadySynced++;
    } else {
      needsBackfill++;
      eventsToBackfill.push(event);
    }
  }

  console.log(`   ✅ Já sincronizados: ${alreadySynced}`);
  console.log(`   🔧 Precisam backfill: ${needsBackfill}\n`);

  if (needsBackfill === 0) {
    console.log('✅ Todos os eventos já foram sincronizados!\n');
    return;
  }

  // 3. Backfill dos eventos perdidos
  console.log('🔧 Iniciando backfill...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const event of eventsToBackfill) {
    try {
      // Buscar o log correspondente pelo resendEmailId
      const emailLog = await prisma.emailLog.findFirst({
        where: {
          resendEmailId: event.resend_email_id,
        },
      });

      if (!emailLog) {
        console.warn(
          `   ⚠️  Log não encontrado para resendEmailId: ${event.resend_email_id} (${event.recipient_email})`
        );
        errorCount++;
        continue;
      }

      // Se o log já tem openedAt, pular
      if (emailLog.openedAt) {
        console.log(
          `   ✅ Log ${emailLog.id.substring(0, 8)} já tem openedAt: ${emailLog.openedAt.toISOString()}`
        );
        alreadySynced++;
        continue;
      }

      // Atualizar o log com a data de abertura
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          openedAt: event.occurred_at,
          status: 'delivered', // garantir que está delivered
        },
      });

      console.log(
        `   ✅ Backfill: Log ${emailLog.id.substring(0, 8)} (${event.recipient_email}) → openedAt: ${event.occurred_at.toISOString()}`
      );
      successCount++;
    } catch (error) {
      console.error(`   ❌ Erro ao processar evento ${event.radar_event_id}:`, error);
      errorCount++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMO DO BACKFILL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`   ✅ Backfill bem-sucedido: ${successCount}`);
  console.log(`   ⚠️  Já sincronizados: ${alreadySynced}`);
  console.log(`   ❌ Erros: ${errorCount}\n`);

  // 4. Recomputar métricas das campanhas afetadas
  if (successCount > 0) {
    console.log('📊 Recomputando métricas das campanhas...\n');

    const affectedCampaigns = await prisma.emailCampaign.findMany({
      where: {
        teamId: MULTISKILL_TEAM_ID,
        name: { contains: 'Rede Dor', mode: 'insensitive' },
      },
    });

    for (const campaign of affectedCampaigns) {
      const metrics = await prisma.emailLog.groupBy({
        by: ['campaignId'],
        where: { campaignId: campaign.id },
        _count: {
          id: true,
        },
        _sum: {
          // Prisma não suporta SUM de campos booleanos diretamente
          // então vamos fazer uma query raw para contar
        },
      });

      const openedCount = await prisma.emailLog.count({
        where: {
          campaignId: campaign.id,
          openedAt: { not: null },
        },
      });

      const clickedCount = await prisma.emailLog.count({
        where: {
          campaignId: campaign.id,
          clickedAt: { not: null },
        },
      });

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          totalOpened: openedCount,
          totalClicked: clickedCount,
        },
      });

      console.log(`   ✅ Campanha "${campaign.name}" atualizada:`);
      console.log(`      Opened: ${campaign.totalOpened} → ${openedCount}`);
      console.log(`      Clicked: ${campaign.totalClicked} → ${clickedCount}\n`);
    }
  }

  console.log('✅ Backfill concluído!\n');
}

main()
  .catch((error) => {
    console.error('❌ Erro no backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
