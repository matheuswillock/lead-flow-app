import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('\n🔍 ===== DIAGNÓSTICO DO BANCO DE DADOS =====\n')

  try {
    // 1. Verificar Profiles
    console.log('📋 === PROFILES (Usuários) ===')
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
    console.log(`Total de profiles: ${profiles.length}\n`)
    profiles.forEach(p => {
      console.log(`  • ${p.fullName} (${p.email})`)
      console.log(`    Role: ${p.role} | Master: ${p.isMaster}`)
      console.log(`    Manager ID: ${p.managerId || 'N/A'}`)
      console.log(`    Leads como Manager: ${p._count.leadsAsManager}`)
      console.log(`    Leads Atribuídos: ${p._count.leadsAsAssignee}`)
      console.log(`    Criado: ${p.createdAt.toLocaleString('pt-BR')}`)
      console.log('')
    })

    // 2. Verificar Leads
    console.log('\n📊 === LEADS ===')
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
    console.log(`Total de leads: ${leads.length}\n`)
    
    if (leads.length === 0) {
      console.log('  ⚠️  Nenhum lead encontrado no banco de dados!\n')
    } else {
      leads.forEach(l => {
        console.log(`  • ${l.name} (${l.email || 'sem email'})`)
        console.log(`    Status: ${l.status}`)
        console.log(`    Manager: ${l.manager.fullName} (${l.manager.email})`)
        console.log(`    Atribuído a: ${l.assignee?.fullName || 'Não atribuído'}`)
        console.log(`    Criado: ${l.createdAt.toLocaleString('pt-BR')}`)
        console.log('')
      })
    }

    // 3. Verificar Pending Operators
    console.log('\n⏳ === PENDING OPERATORS ===')
    const pendingOps = await prisma.pendingOperator.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: {
          select: { fullName: true, email: true }
        }
      }
    })
    console.log(`Total de operadores pendentes: ${pendingOps.length}\n`)
    pendingOps.forEach(po => {
      console.log(`  • ${po.name} (${po.email})`)
      console.log(`    Status Pagamento: ${po.paymentStatus}`)
      console.log(`    Operador Criado: ${po.operatorCreated}`)
      console.log(`    Manager: ${po.manager.fullName}`)
      console.log('')
    })

    // 4. Resumo Geral
    console.log('\n📈 === RESUMO GERAL ===')
    const managers = profiles.filter(p => p.role === 'manager').length
    const operators = profiles.filter(p => p.role === 'operator').length
    const masters = profiles.filter(p => p.isMaster).length
    
    console.log(`  Managers: ${managers}`)
    console.log(`  Operators: ${operators}`)
    console.log(`  Masters: ${masters}`)
    console.log(`  Total Leads: ${leads.length}`)
    console.log(`  Pending Operators: ${pendingOps.length}`)

    // 5. Verificar problemas de integridade
    console.log('\n⚠️  === VERIFICAÇÃO DE INTEGRIDADE ===')
    
    // Como não há leads, pular verificação de integridade
    if (totalLeads === 0) {
      console.log('✅ Nenhum lead no banco - verificação de integridade não necessária')
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
          console.log(`  ⚠️  ${op.fullName} tem ${wrongLeads.length} leads de outro manager:`)
          wrongLeads.forEach(l => {
            console.log(`      - Lead: ${l.name} (Manager ID: ${l.managerId})`)
          })
          console.log(`      Manager esperado: ${op.managerId}\n`)
        }
      })

      if (!hasIntegrityIssues) {
        console.log('  ✅ Nenhum problema de integridade encontrado!\n')
      }
    }

  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
