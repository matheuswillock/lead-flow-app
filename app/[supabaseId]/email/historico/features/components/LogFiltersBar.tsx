"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useHistoricoContext } from "../context/HistoricoContext"
import { EMAIL_LOG_STATUS_FILTER_OPTIONS } from "@/lib/email/email-log-status-badge"

export function LogFiltersBar() {
  const {
    search,
    statusFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    handleSearch,
    handleStatusFilter,
    handleCategoryFilter,
    handleDateFilter,
  } = useHistoricoContext()

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-52 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por e-mail ou assunto..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={categoryFilter || "__all"} onValueChange={(v) => handleCategoryFilter(v === "__all" ? "" : v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Todos os tipos</SelectItem>
          <SelectItem value="campaign">Campanha</SelectItem>
          <SelectItem value="meeting_invite">Convite de reunião</SelectItem>
          <SelectItem value="schedule_notification">Notificação de agenda</SelectItem>
          <SelectItem value="transactional">Transacional</SelectItem>
          <SelectItem value="other">Outro</SelectItem>
        </SelectContent>
      </Select>

      <Select value={statusFilter || "__all"} onValueChange={(v) => handleStatusFilter(v === "__all" ? "" : v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Todos os status</SelectItem>
          {/*
            Derivado da mesma fonte dos badges: a lista escrita à mão aqui não
            acompanhou o status `suppressed`, então a tabela renderizava a linha
            "Recusado" e o usuário não tinha como isolá-la por filtro nenhum.
          */}
          {EMAIL_LOG_STATUS_FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFilter(e.target.value, dateTo)}
          className="w-40"
          title="De"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateFilter(dateFrom, e.target.value)}
          className="w-40"
          title="Até"
        />
      </div>
    </div>
  )
}
