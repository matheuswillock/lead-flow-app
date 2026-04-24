import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.info('\n🔍 ===== DIAGNÓSTICO DO BANCO DE DADOS =====\n')

  try {
    // 1. Verificar Profiles
    console.info('📋 === PROFILES (Usuários) ===')
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isMaster: true,
        managerId: true,
        createdAt: true,
        _count: {
          select: {
            leadsAsManager: true,
            leadsAsAssignee: true,
          }
        }
      }
    })
    console.info(`Total de profiles: ${profiles.length}\n`)
    profiles.forEach(p => {
      console.info(`  • ${p.fullName} (${p.email})`)
      console.info(`    Role: ${p.role} | Master: ${p.isMaster}`)
      console.info(`    Manager ID: ${p.managerId || 'N/A'}`)
      console.info(`    Leads como Manager: ${p._count.leadsAsManager}`)
      console.info(`    Leads Atribuídos: ${p._count.leadsAsAssignee}`)
      console.info(`    Criado: ${p.createdAt.toLocaleString('pt-BR')}`)
      console.info('')
    })

    // 2. Verificar Leads
    console.info('\n📊 === LEADS ===')
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: {
          select: { fullName: true, email: true }
        },
        assignee: {
          select: { fullName: true, email: true }
        }
      }
    })
    console.info(`Total de leads: ${leads.length}\n`)
    
    if (leads.length === 0) {
      console.info('  ⚠️  Nenhum lead encontrado no banco de dados!\n')
    } else {
      leads.forEach(l => {
        console.info(`  • ${l.name} (${l.email || 'sem email'})`)
        console.info(`    Status: ${l.status}`)
        console.info(`    Manager: ${l.manager.fullName} (${l.manager.email})`)
        console.info(`    Atribuído a: ${l.assignee?.fullName || 'Não atribuído'}`)
        console.info(`    Criado: ${l.createdAt.toLocaleString('pt-BR')}`)
        console.info('')
      })
    }

    // 3. Verificar Pending Operators
    console.info('\n⏳ === PENDING OPERATORS ===')
    const pendingOps = await prisma.pendingOperator.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: {
          select: { fullName: true, email: true }
        }
      }
    })
    console.info(`Total de operadores pendentes: ${pendingOps.length}\n`)
    pendingOps.forEach(po => {
      console.info(`  • ${po.name} (${po.email})`)
      console.info(`    Status Pagamento: ${po.paymentStatus}`)
      console.info(`    Operador Criado: ${po.operatorCreated}`)
      console.info(`    Manager: ${po.manager.fullName}`)
      console.info('')
    })

    // 4. Resumo Geral
    console.info('\n📈 === RESUMO GERAL ===')
    const managers = profiles.filter(p => p.role === 'manager').length
    const operators = profiles.filter(p => p.role === 'operator').length
    const masters = profiles.filter(p => p.isMaster).length
    
    console.info(`  Managers: ${managers}`)
    console.info(`  Operators: ${operators}`)
    console.info(`  Masters: ${masters}`)
    console.info(`  Total Leads: ${leads.length}`)
    console.info(`  Pending Operators: ${pendingOps.length}`)

    // 5. Verificar problemas de integridade
    console.info('\n⚠️  === VERIFICAÇÃO DE INTEGRIDADE ===')
    
    // Como não há leads, pular verificação de integridade
    if (leads.length === 0) {
      console.info('✅ Nenhum lead no banco - verificação de integridade não necessária')
    } else {
      // Verificar operadores com leads de outro manager
      const allOperators = await prisma.profile.findMany({
        where: {
          role: 'operator',
          managerId: { not: null }
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          managerId: true,
          leadsAsAssignee: {
            select: {
              id: true,
              name: true,
              managerId: true
            }
          }
        }
      })
      
      const operatorsWithWrongLeads = allOperators.filter(op => 
        op.leadsAsAssignee.some(lead => lead.managerId !== op.managerId)
      )

      let hasIntegrityIssues = false
      operatorsWithWrongLeads.forEach(op => {
        const wrongLeads = op.leadsAsAssignee.filter(
          lead => lead.managerId !== op.managerId
        )
        
        if (wrongLeads.length > 0) {
          hasIntegrityIssues = true
          console.info(`  ⚠️  ${op.fullName} tem ${wrongLeads.length} leads de outro manager:`)
          wrongLeads.forEach(l => {
            console.info(`      - Lead: ${l.name} (Manager ID: ${l.managerId})`)
          })
          console.info(`      Manager esperado: ${op.managerId}\n`)
        }
      })

      if (!hasIntegrityIssues) {
        console.info('  ✅ Nenhum problema de integridade encontrado!\n')
      }
    }

  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
