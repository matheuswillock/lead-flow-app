"use client"

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { usePageBreadcrumb } from '@/app/context/PageBreadcrumbContext'

const EMAIL_SECTION_LABELS: Record<string, string> = {
  templates: 'Templates',
  contatos: 'Contatos',
  campanhas: 'Campanhas',
  historico: 'Histórico',
  analytics: 'Analytics',
  configuracoes: 'Configurações',
}

export function SiteHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { override } = usePageBreadcrumb()
  const pathSegments = (pathname || '/').split('/').filter(Boolean)

  // pathSegments: [supabaseId, section, subsection?, id?]
  const supabaseId = pathSegments[0] ?? ''
  const section = pathSegments[1] ?? ''
  const subsection = pathSegments[2] ?? ''
  const deepSegment = pathSegments[3] ?? ''

  const isEmailSection = section === 'email'
  const isPerformanceSection = section === 'performance'
  const isBackofficeClientDetails =
    pathSegments[0] === 'backoffice' && pathSegments[1] === 'clients' && Boolean(pathSegments[2])

  const routeName = pathSegments.length >= 2 ? pathSegments[1] : pathSegments[0] || ''
  const titleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    crm: 'CRM',
    board: 'Board',
    pipeline: 'Pipeline',
    calendar: 'Calendário',
    account: 'Account',
    subscription: 'Assinatura',
    'manager-users': 'Gerenciar Usuários',
    teams: 'Gerenciar Times',
    notifications: 'Notificações',
    clients: 'Clientes',
    payments: 'Pagamentos',
    users: 'Usuários',
  }
  const currentTitle = titleMap[routeName] ?? ''

  const backofficeClientName = searchParams.get('name') || 'Usuário'
  const detailsTab = searchParams.get('tab') === 'invoices' ? 'Faturas' : 'Times'

  const emailBaseHref = `/${supabaseId}/email`
  const performanceBaseHref = `/${supabaseId}/performance`

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b box-border transition-[height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        {isEmailSection ? (
          <Breadcrumb>
            <BreadcrumbList>
              {subsection && EMAIL_SECTION_LABELS[subsection] ? (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                      <Link href={`${emailBaseHref}/${subsection}`}>
                        {EMAIL_SECTION_LABELS[subsection]}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {deepSegment && (
                    <>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {override?.label ?? (deepSegment === 'new' ? 'Novo template' : 'Editar template')}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                  {!deepSegment && (
                    <BreadcrumbItem className="md:hidden">
                      <BreadcrumbPage>{EMAIL_SECTION_LABELS[subsection]}</BreadcrumbPage>
                    </BreadcrumbItem>
                  )}
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>E-mail</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        ) : isPerformanceSection && subsection === 'reunioes-realizadas' ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link href={performanceBaseHref}>Performance</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {override?.label ?? 'Reuniões realizadas'}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : isBackofficeClientDetails ? (
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/backoffice/clients">Clientes</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{backofficeClientName}</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{detailsTab}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className="text-sm font-semibold">{currentTitle}</h1>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
