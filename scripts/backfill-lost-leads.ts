#!/usr/bin/env tsx
// @ts-nocheck — one-off investigation script; schema fields may drift
/* eslint-disable no-console */
/**
 * Script de Backfill: Leads Perdidos
 * 
 * Objetivo: Recuperar leads que deveriam ter sido criados a partir de eventos form.started
 * mas foram perdidos devido a falhas de validação ou bugs do sistema
 * 
 * Uso:
 *   npx tsx scripts/backfill-lost-leads.ts --dry-run  # Preview das mudanças
 *   npx tsx scripts/backfill-lost-leads.ts --apply    # Aplicar backfill
 */

import { PrismaClient, LeadOriginChannel } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('❌ Uso: npx tsx scripts/backfill-lost-leads.ts [--dry-run|--apply]');
  process.exit(1);
}

interface LostLeadCandidate {
  eventId: string;
  profileId: string;
  occurredAt: Date;
  recipientEmail: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  displayName: string | null;
  teamId: string;
  teamName: string;
  campaignId: string | null;
  campaignName: string | null;
  metadata: any;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(`🔧 BACKFILL: Leads Perdidos ${isDryRun ? '(DRY RUN)' : '(APPLY)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Buscar os times
  console.log('📋 Buscando times...\n');

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { name: { contains: 'Multiskill', mode: 'insensitive' } },
        { name: { contains: 'Katherein', mode: 'insensitive' } },
        { name: { contains: 'Avalanche', mode: 'insensitive' } },
      ],
    },
    include: {
      master: {
        select: { id: true, email: true },
      },
    },
  });

  console.log(`✅ ${teams.length} times encontrados\n`);

  const candidatesToBackfill: LostLeadCandidate[] = [];

  // 2. Para cada time, buscar eventos órfãos recuperáveis
  for (const team of teams) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Analisando: ${team.name}\n`);

    // 2.1 Buscar eventos form.started com recipientEmail mas sem lead
    const orphanEvents = await prisma.$queryRaw<
      Array<{
        eventId: string;
        profileId: string;
        occurredAt: Date;
        recipientEmail: string | null;
        normalizedEmail: string | null;
        normalizedPhone: string | null;
        displayName: string | null;
        metadata: any;
      }>
    >`
      SELECT 
        re.id as "eventId",
        re."profileId",
        re."occurredAt",
        re.metadata->'origin'->>'recipientEmail' as "recipientEmail",
        rp."normalizedPrimaryEmail" as "normalizedEmail",
        rp."normalizedPhone",
        rp."displayName",
        re.metadata
      FROM corretor_studio_radar_events re
      JOIN corretor_studio_radar_profiles rp ON re."profileId" = rp.id
      WHERE rp."teamId" = ${team.id}::uuid
        AND re."occurredAt" >= ${thirtyDaysAgo}
        AND re."eventType" = 'form.started'
        AND re.metadata->'origin'->>'recipientEmail' IS NOT NULL
      ORDER BY re."occurredAt" DESC
    `;

    // Verificar quais não têm lead associado
    const orphanEventsWithoutLead = [];
    for (const event of orphanEvents) {
      const leadIdentity = await prisma.radarIdentity.findFirst({
        where: {
          profileId: event.profileId,
          type: 'lead_id',
        },
      });

      if (!leadIdentity) {
        orphanEventsWithoutLead.push(event);
      }
    }

    console.log(`   🔍 ${orphanEvents.length} eventos form.started de email encontrados`);
    console.log(`   🔍 ${orphanEventsWithoutLead.length} sem lead associado\n`);

    if (orphanEventsWithoutLead.length === 0) {
      console.log('   ✅ Nenhum lead órfão detectado!\n');
      continue;
    }

    // 2.2 Validar candidatos recuperáveis
    for (const event of orphanEventsWithoutLead) {
      if (!event.recipientEmail) continue;

      // Buscar EmailLog para validar origem
      const emailLog = await prisma.emailLog.findFirst({
        where: {
          recipientEmail: event.recipientEmail,
          sentAt: {
            gte: new Date(event.occurredAt.getTime() - 7 * 24 * 60 * 60 * 1000),
            lte: event.occurredAt,
          },
        },
        include: {
          dispatch: {
            include: {
              campaign: true,
            },
          },
        },
        orderBy: {
          sentAt: 'desc',
        },
      });

      // Validar: tem dados mínimos + emailLog válido
      const hasMinimalData = (event.normalizedEmail || event.normalizedPhone) && event.displayName;
      const hasValidEmailLog = emailLog && emailLog.status !== 'failed';

      if (hasMinimalData && hasValidEmailLog) {
        candidatesToBackfill.push({
          eventId: event.eventId,
          profileId: event.profileId,
          occurredAt: event.occurredAt,
          recipientEmail: event.recipientEmail,
          normalizedEmail: event.normalizedEmail,
          normalizedPhone: event.normalizedPhone,
          displayName: event.displayName,
          teamId: team.id,
          teamName: team.name,
          campaignId: emailLog.dispatch?.campaign?.id || null,
          campaignName: emailLog.dispatch?.campaign?.name || null,
          metadata: event.metadata,
        });
      }
    }

    console.log(`   ✅ ${candidatesToBackfill.length} candidatos recuperáveis identificados\n`);
  }

  // 3. Relatório de candidatos
  if (candidatesToBackfill.length === 0) {
    console.log('✅ Nenhum lead perdido recuperável encontrado!\n');
    return;
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(`📊 CANDIDATOS PARA BACKFILL: ${candidatesToBackfill.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  const byTeam = new Map<string, number>();
  candidatesToBackfill.forEach((c) => {
    byTeam.set(c.teamName, (byTeam.get(c.teamName) || 0) + 1);
  });

  console.log('Distribuição por time:');
  byTeam.forEach((count, teamName) => {
    console.log(`   • ${teamName}: ${count} leads`);
  });
  console.log('');

  // 4. Aplicar backfill ou mostrar preview
  if (isDryRun) {
    console.log('🔍 DRY RUN - Preview dos leads que seriam criados:\n');
    candidatesToBackfill.slice(0, 20).forEach((candidate, idx) => {
      console.log(`[${idx + 1}] ${candidate.displayName}`);
      console.log(`    Email: ${candidate.normalizedEmail || candidate.recipientEmail}`);
      console.log(`    Phone: ${candidate.normalizedPhone || 'N/A'}`);
      console.log(`    Team: ${candidate.teamName}`);
      console.log(`    Campaign: ${candidate.campaignName || 'N/A'}`);
      console.log(`    Occurred: ${candidate.occurredAt.toISOString()}`);
      console.log('');
    });

    console.log('\n✅ Para aplicar o backfill, execute:');
    console.log('   npx tsx scripts/backfill-lost-leads.ts --apply\n');
    return;
  }

  // 5. Aplicar backfill (--apply)
  console.log('🔧 Aplicando backfill...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ candidate: LostLeadCandidate; error: string }> = [];

  for (const candidate of candidatesToBackfill) {
    try {
      // Buscar o manager (master do time)
      const team = teams.find((t) => t.id === candidate.teamId);
      if (!team) {
        throw new Error('Time não encontrado');
      }

      // Gerar leadCode único
      const leadCode = `BACKFILL-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Criar lead
      const lead = await prisma.lead.create({
        data: {
          leadCode,
          managerId: team.master.id,
          teamId: candidate.teamId,
          name: candidate.displayName || 'Lead Recuperado',
          email: candidate.normalizedEmail || candidate.recipientEmail,
          phone: candidate.normalizedPhone || undefined,
          status: 'new_opportunity',
          originChannel: 'public_form' as LeadOriginChannel,
          originMetadata: {
            attribution: 'email_campaign',
            campaignId: candidate.campaignId,
            campaignName: candidate.campaignName,
            radarEventId: candidate.eventId,
            radarProfileId: candidate.profileId,
            backfilled: true,
            backfilledAt: new Date().toISOString(),
          },
          createdAt: candidate.occurredAt, // manter data original do evento
        },
      });

      // Criar identity no Radar para vincular lead ao profile
      await prisma.radarIdentity.create({
        data: {
          profileId: candidate.profileId,
          teamId: candidate.teamId,
          type: 'lead_id',
          normalizedValue: lead.id,
        },
      });

      console.log(
        `   ✅ Lead criado: ${lead.name} (${lead.email || lead.phone}) - ${lead.id.substring(0, 8)}...`
      );
      successCount++;
    } catch (error) {
      console.error(`   ❌ Erro ao criar lead para ${candidate.displayName}:`, error);
      errors.push({
        candidate,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      errorCount++;
    }
  }

  // 6. Resumo final
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMO DO BACKFILL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`   ✅ Leads criados: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}\n`);

  if (errors.length > 0) {
    console.log('Erros detalhados:');
    errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.candidate.displayName}: ${err.error}`);
    });
    console.log('');
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
