"use client"

import { useEffect } from "react"
import { Globe, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { ResendDomainStatus } from "../context/EmailSettingsTypes"

function DomainStatusBadge({ status }: { status: ResendDomainStatus | null }) {
  if (!status) return null
  const map: Record<ResendDomainStatus, { label: string; icon: React.ReactNode; className: string }> = {
    verified: { label: "Verificado", icon: <CheckCircle2 className="size-3" />, className: "bg-semantic-success/10 text-semantic-success border-semantic-success/20" },
    pending: { label: "Pendente", icon: <Clock className="size-3" />, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    not_started: { label: "Não iniciado", icon: <Globe className="size-3" />, className: "bg-muted text-muted-foreground" },
    failed: { label: "Falhou", icon: <XCircle className="size-3" />, className: "bg-destructive/10 text-destructive border-destructive/20" },
    temporary_failure: { label: "Falha temporária", icon: <AlertCircle className="size-3" />, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  }
  const config = map[status]
  return (
    <Badge variant="outline" className={cn("gap-1", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

export function CustomDomainCard() {
  const {
    loading,
    domainInput,
    setDomainInput,
    domainRecords,
    domainStatus,
    domainName,
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    disconnectingDomain,
    handleConnectDomain,
    handleDisconnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
  } = useEmailSettingsContext()

  useEffect(() => {
    if (domainName && domainRecords.length === 0) {
      void handleLoadDomainRecords()
    }
  }, [domainName, domainRecords.length, handleLoadDomainRecords])

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Domínio personalizado</CardTitle>
        <CardDescription>
          Conecte um domínio próprio ao Resend para enviar emails do seu endereço corporativo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
          </div>
        ) : domainName ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">{domainName}</span>
                <DomainStatusBadge status={domainStatus} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVerifyDomain()}
                  disabled={verifyingDomain || loadingRecords}
                >
                  {verifyingDomain ? "Verificando..." : "Verificar DNS"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={disconnectingDomain}>
                      Desconectar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar domínio</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja desconectar o domínio <strong>{domainName}</strong>?
                        Os disparos voltarão a usar o domínio padrão do Corretor Studio.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleDisconnectDomain()}>
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {domainStatus !== "verified" && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Registros DNS necessários</p>
                  <p className="text-xs text-muted-foreground">
                    Adicione os registros abaixo no painel DNS do seu domínio e clique em "Verificar DNS".
                  </p>
                  {loadingRecords ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : domainRecords.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs">Nome</TableHead>
                            <TableHead className="text-xs">Valor</TableHead>
                            <TableHead className="text-xs">TTL</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {domainRecords.map((record, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-mono">{record.type}</TableCell>
                              <TableCell className="text-xs font-mono max-w-40 truncate">{record.name}</TableCell>
                              <TableCell className="text-xs font-mono max-w-52 truncate">{record.value}</TableCell>
                              <TableCell className="text-xs">{record.ttl}</TableCell>
                              <TableCell className="text-xs">
                                {record.status === "verified" ? (
                                  <CheckCircle2 className="size-4 text-semantic-success" />
                                ) : (
                                  <Clock className="size-4 text-amber-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Nenhum domínio conectado. Informe o domínio para configurar os registros DNS no Resend.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: email.suaempresa.com.br"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                disabled={connectingDomain}
                className="max-w-80"
                onKeyDown={(e) => { if (e.key === "Enter") void handleConnectDomain() }}
              />
              <Button
                onClick={() => void handleConnectDomain()}
                disabled={connectingDomain || !domainInput.trim()}
              >
                {connectingDomain ? "Conectando..." : "Conectar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
