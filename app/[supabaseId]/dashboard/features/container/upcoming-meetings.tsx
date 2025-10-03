"use client"

import * as React from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Clock, User, Calendar } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface ScheduleData {
  id: string
  date: string
  leadName: string
  leadEmail: string
  leadPhone: string
  responsible: string
  responsibleEmail: string
  notes?: string
  leadId: string
}

interface UpcomingMeetingsProps {
  supabaseId: string
}

export function UpcomingMeetings({ supabaseId }: UpcomingMeetingsProps) {
  const [schedules, setSchedules] = React.useState<ScheduleData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/v1/dashboard/schedules', {
          headers: {
            'x-supabase-user-id': supabaseId,
          },
        })

        const data = await response.json()

        if (data.success) {
          setSchedules(data.data || [])
        } else {
          setError(data.errors?.[0] || 'Erro ao carregar agendamentos')
        }
      } catch (err) {
        setError('Erro ao carregar agendamentos')
        console.error('Erro ao buscar agendamentos:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (supabaseId) {
      fetchSchedules()
    }
  }, [supabaseId])

  const getInitials = (name: string) => {
    const names = name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getTimeUntilMeeting = (dateString: string) => {
    try {
      const meetingDate = new Date(dateString)
      return formatDistanceToNow(meetingDate, { 
        locale: ptBR,
        addSuffix: true 
      })
    } catch {
      return 'Data inválida'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reuniões
          </CardTitle>
          <CardDescription>Reuniões agendadas para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground text-sm">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reuniões
          </CardTitle>
          <CardDescription>Reuniões agendadas para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-destructive text-sm">{error}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reuniões
          </CardTitle>
          <CardDescription>Reuniões agendadas para hoje</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="text-muted-foreground mb-2 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              Nenhuma reunião agendada para hoje
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Próximas Reuniões
        </CardTitle>
        <CardDescription>
          {schedules.length} {schedules.length === 1 ? 'reunião agendada' : 'reuniões agendadas'} para hoje
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Tempo Restante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => {
                const meetingDate = new Date(schedule.date)
                const now = new Date()
                const isPast = meetingDate < now

                return (
                  <TableRow key={schedule.id} className={isPast ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="text-muted-foreground h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(meetingDate, "HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {format(meetingDate, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{schedule.leadName}</span>
                        <span className="text-muted-foreground text-xs">
                          {schedule.leadEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(schedule.responsible)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{schedule.responsible}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={isPast ? "secondary" : "default"}>
                        {isPast ? "Passou" : getTimeUntilMeeting(schedule.date)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
