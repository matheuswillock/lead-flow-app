"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"

const SOURCE_OPTIONS = [
  { value: "all", label: "Todas as origens" },
  { value: "channel", label: "Canal" },
  { value: "web", label: "Web" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Pendente" },
  { value: "verified", label: "Verificado" },
  { value: "failed", label: "Falhou" },
  { value: "expired", label: "Expirado" },
]

export function BackofficeStudioBotVerificacoesContainer() {
  const { tz } = useTimezone()
  const {
    authChallenges,
    authChallengesFilters,
    authChallengesPagination,
    isLoadingAuthChallenges,
    setAuthChallengesFilters,
    setAuthChallengesPage,
    loadAuthChallenges,
  } = useBackofficeStudioBot()

  useEffect(() => {
    void loadAuthChallenges()
  }, [loadAuthChallenges])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Verificações</h1>
        <p className="text-sm text-muted-foreground">
          Auditoria read-only dos desafios de autenticação da Bethânia.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={authChallengesFilters.source}
          onValueChange={(source) => setAuthChallengesFilters({ ...authChallengesFilters, source })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={authChallengesFilters.status}
          onValueChange={(status) => setAuthChallengesFilters({ ...authChallengesFilters, status })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingAuthChallenges ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : authChallenges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhuma verificação encontrada
                </TableCell>
              </TableRow>
            ) : (
              authChallenges.map((challenge) => (
                <TableRow key={challenge.id}>
                  <TableCell className="text-sm">{challenge.source}</TableCell>
                  <TableCell className="text-sm">
                    {challenge.normalizedPhone ? maskPhone(challenge.normalizedPhone) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{challenge.emailRequested ?? "—"}</TableCell>
                  <TableCell className="text-sm">{challenge.status}</TableCell>
                  <TableCell className="text-sm tabular-nums">{challenge.attemptCount}</TableCell>
                  <TableCell className="text-sm">
                    {formatIntimezone(new Date(challenge.expiresAt), "dd/MM/yyyy HH:mm", tz)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatIntimezone(new Date(challenge.createdAt), "dd/MM/yyyy HH:mm", tz)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {authChallengesPagination.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!authChallengesPagination.hasPreviousPage}
            onClick={() => setAuthChallengesPage(authChallengesPagination.page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {authChallengesPagination.page} de {authChallengesPagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!authChallengesPagination.hasNextPage}
            onClick={() => setAuthChallengesPage(authChallengesPagination.page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  )
}
