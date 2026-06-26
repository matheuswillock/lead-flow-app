"use client"

import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { OffHoursSchedule } from '../context/WhatsAppAutoResponsesTypes'

const WEEKDAYS: Array<{ key: keyof NonNullable<OffHoursSchedule['days']>; label: string }> = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

interface OffHoursScheduleEditorProps {
  value: OffHoursSchedule | null
  onChange: (value: OffHoursSchedule) => void
}

export function OffHoursScheduleEditor({ value, onChange }: OffHoursScheduleEditorProps) {
  const schedule = value ?? { timezone: 'America/Sao_Paulo', days: {} }

  const updateDay = (dayKey: keyof NonNullable<OffHoursSchedule['days']>, start: string, end: string) => {
    onChange({
      ...schedule,
      days: {
        ...schedule.days,
        [dayKey]: start && end ? [{ start, end }] : [],
      },
    })
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="timezone">Fuso horário</FieldLabel>
        <Input
          id="timezone"
          value={schedule.timezone ?? 'America/Sao_Paulo'}
          onChange={(event) => onChange({ ...schedule, timezone: event.target.value })}
          placeholder="America/Sao_Paulo"
        />
      </Field>

      {WEEKDAYS.map(({ key, label }) => {
        const range = schedule.days?.[key]?.[0]
        return (
          <Field key={key}>
            <FieldLabel>{label}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="time"
                value={range?.start ?? ''}
                onChange={(event) => updateDay(key, event.target.value, range?.end ?? '18:00')}
              />
              <Input
                type="time"
                value={range?.end ?? ''}
                onChange={(event) => updateDay(key, range?.start ?? '09:00', event.target.value)}
              />
            </div>
          </Field>
        )
      })}
    </FieldGroup>
  )
}
