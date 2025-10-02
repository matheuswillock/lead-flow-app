# Date and Time Picker Component Implementation

## 📋 Overview

This document describes the implementation of a reusable Date and Time Picker component for the Lead Flow application, following shadcn/ui patterns and best practices.

## 🎯 Objectives

- Create a reusable date and time picker component
- Improve user experience in the scheduling flow
- Follow shadcn/ui design patterns
- Support Brazilian Portuguese (pt-BR) locale
- Provide a clean and intuitive interface

## 🏗️ Architecture

### Component Structure

```
components/ui/
  ├── date-time-picker.tsx (NEW)
  ├── calendar.tsx (existing)
  ├── popover.tsx (existing)
  └── button.tsx (existing)

app/[supabaseId]/board/features/container/
  └── ScheduleMeetingDialog.tsx (UPDATED)
```

## 📦 Components

### 1. DateTimePicker Component

**File:** `components/ui/date-time-picker.tsx`

#### Features

- **Date Selection**: Calendar popup with pt-BR locale
- **Time Selection**: HTML5 time input
- **Past Date Blocking**: Optional feature to disable past dates
- **Required Field Support**: Visual indicator for required fields
- **Disabled State**: Can be disabled via props
- **Auto Sync**: Automatically syncs date and time changes

#### Props Interface

```typescript
interface DateTimePickerProps {
  date?: Date                      // Current selected date/time
  onDateChange: (date: Date | undefined) => void  // Change handler
  disabled?: boolean               // Disable the picker
  disablePastDates?: boolean      // Block past dates
  className?: string               // Additional CSS classes
  label?: string                   // Label text
  required?: boolean               // Show required indicator
}
```

#### Default Values

- `disabled`: `false`
- `disablePastDates`: `true`
- `label`: `"Data e Hora"`
- `required`: `false`
- Default time: `"10:00"`

#### Usage Example

```tsx
import { DateTimePicker } from "@/components/ui/date-time-picker"

function MyComponent() {
  const [meetingDate, setMeetingDate] = useState<Date>()

  return (
    <DateTimePicker
      date={meetingDate}
      onDateChange={setMeetingDate}
      label="Data e Horário da Reunião"
      required
      disablePastDates
    />
  )
}
```

### 2. Updated ScheduleMeetingDialog

**File:** `app/[supabaseId]/board/features/container/ScheduleMeetingDialog.tsx`

#### Changes Made

**Before:**
```tsx
// Separate date and time states
const [date, setDate] = useState<Date>();
const [time, setTime] = useState<string>("09:00");

// Manual date/time combination
const [hours, minutes] = time.split(":");
const meetingDateTime = new Date(date);
meetingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

// Separate UI for date and time
<Popover>...</Popover>
<input type="time" ... />
```

**After:**
```tsx
// Single state for date+time
const [meetingDate, setMeetingDate] = useState<Date>();

// Direct usage
<DateTimePicker
  date={meetingDate}
  onDateChange={setMeetingDate}
  label="Data e Horário da Reunião"
  required
  disablePastDates
/>

// API call with combined date/time
body: JSON.stringify({
  date: meetingDate.toISOString(),
  notes: notes || `Reunião agendada com ${lead.name}`,
})
```

#### Benefits

1. **Simplified State Management**
   - Single `meetingDate` state instead of separate `date` and `time`
   - No manual date/time combination needed
   - Reduced complexity in form handling

2. **Better User Experience**
   - Unified date and time picker interface
   - Real-time synchronization between date and time
   - Clear visual feedback for required fields
   - Past dates automatically disabled

3. **Code Reusability**
   - DateTimePicker can be used in other dialogs/forms
   - Consistent behavior across the application
   - Easy to maintain and update

4. **Type Safety**
   - Strong TypeScript typing
   - Clear prop interfaces
   - Better IDE support

## 🎨 UI/UX Features

### Visual Design

1. **Responsive Layout**
   - Mobile: Stacked date picker and time input
   - Desktop: Side-by-side layout with proper spacing

2. **Accessibility**
   - Proper label associations
   - Keyboard navigation support
   - Clear focus indicators
   - Screen reader friendly

3. **Visual Feedback**
   - Required field indicator (red asterisk)
   - Placeholder text when no date selected
   - Disabled state styling
   - Calendar icon for date picker button

### User Interactions

1. **Date Selection**
   - Click button to open calendar popup
   - Select date from calendar
   - Calendar shows current month by default
   - Past dates are grayed out (if `disablePastDates` is true)

2. **Time Selection**
   - Native HTML5 time picker
   - 24-hour or 12-hour format (based on browser locale)
   - Keyboard input support
   - Scroll through hours/minutes

3. **Combined Behavior**
   - Selecting date updates the combined Date object
   - Changing time updates the combined Date object
   - Both changes trigger `onDateChange` callback

## 🔄 Data Flow

### Component Lifecycle

```
1. Component Mount
   └─> Initialize with default time (10:00)
   └─> Set date if provided via props

2. Date Selection
   └─> User clicks date picker button
   └─> Calendar popup opens
   └─> User selects date
   └─> Date is combined with current time
   └─> New Date object created
   └─> onDateChange callback fired

3. Time Change
   └─> User changes time input
   └─> Time is extracted (HH:mm)
   └─> Time is applied to selected date
   └─> New Date object created
   └─> onDateChange callback fired

4. External Props Change
   └─> date prop changes
   └─> Component updates internal state
   └─> UI reflects new date/time
```

### State Synchronization

```typescript
// Internal state tracks selectedDate
const [selectedDate, setSelectedDate] = useState<Date | undefined>(date)

// Time is stored separately for UI purposes
const [time, setTime] = useState<string>(
  date ? format(date, "HH:mm") : "10:00"
)

// Effect syncs with external date prop
useEffect(() => {
  if (date) {
    setSelectedDate(date)
    setTime(format(date, "HH:mm"))
  }
}, [date])
```

## 📝 Implementation Details

### Date Handling

```typescript
// Disable past dates
disabled={
  disablePastDates
    ? (date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))
    : undefined
}
```

### Time Combination

```typescript
const handleDateSelect = (newDate: Date | undefined) => {
  if (!newDate) {
    setSelectedDate(undefined)
    onDateChange(undefined)
    return
  }

  // Apply current time to new date
  const [hours, minutes] = time.split(":").map(Number)
  newDate.setHours(hours, minutes, 0, 0)
  setSelectedDate(newDate)
  onDateChange(newDate)
}
```

### Date Application

```typescript
const handleTimeChange = (newTime: string) => {
  setTime(newTime)

  if (selectedDate) {
    const [hours, minutes] = newTime.split(":").map(Number)
    const newDate = new Date(selectedDate)
    newDate.setHours(hours, minutes, 0, 0)
    setSelectedDate(newDate)
    onDateChange(newDate)
  }
}
```

## 🧪 Testing Scenarios

### Manual Testing Checklist

- [ ] **Date Selection**
  - [ ] Click date picker button opens calendar
  - [ ] Select date updates the display
  - [ ] Past dates are disabled (when `disablePastDates=true`)
  - [ ] Calendar shows Portuguese month/day names

- [ ] **Time Selection**
  - [ ] Time input accepts manual typing
  - [ ] Time picker dropdown works (browser-dependent)
  - [ ] Time changes update the combined date

- [ ] **Combined Behavior**
  - [ ] Changing date preserves selected time
  - [ ] Changing time preserves selected date
  - [ ] Both changes fire the callback

- [ ] **Form Submission**
  - [ ] Submit without date shows error
  - [ ] Submit with valid date/time creates schedule
  - [ ] Success clears the form
  - [ ] Loading state disables inputs

- [ ] **Edge Cases**
  - [ ] Clear date sets undefined
  - [ ] Disabled prop prevents interaction
  - [ ] Required indicator shows when required=true
  - [ ] Works with controlled and uncontrolled patterns

## 🔧 Configuration

### Locale Configuration

The component uses `ptBR` locale from `date-fns`:

```typescript
import { ptBR } from "date-fns/locale"

<Calendar
  locale={ptBR}
  // ... other props
/>
```

### Time Format

The component uses 24-hour format (HH:mm):

```typescript
const [time, setTime] = useState<string>(
  date ? format(date, "HH:mm") : "10:00"
)
```

## 🎯 Benefits

### For Developers

1. **Reusability**: Single component for all date/time picking needs
2. **Type Safety**: Full TypeScript support with clear interfaces
3. **Maintainability**: Centralized logic for date/time handling
4. **Consistency**: Same UX across all forms

### For Users

1. **Intuitive Interface**: Familiar calendar and time picker
2. **Error Prevention**: Past dates disabled by default
3. **Visual Feedback**: Clear indication of required fields
4. **Localized**: Portuguese language support

### For Business

1. **Faster Development**: Reusable component saves time
2. **Better UX**: Consistent and polished interface
3. **Fewer Bugs**: Centralized validation and logic
4. **Easy Updates**: Single point of change

## 🚀 Future Enhancements

### Potential Improvements

1. **Time Zones**
   - Add timezone selection
   - Convert to/from UTC
   - Display timezone indicator

2. **Business Hours**
   - Restrict time selection to business hours
   - Highlight business hours in UI
   - Custom time ranges

3. **Recurring Events**
   - Support for recurring meetings
   - Weekly/monthly patterns
   - Custom recurrence rules

4. **Quick Actions**
   - "Tomorrow at 9 AM" quick button
   - "Next Monday" quick button
   - "In 2 hours" quick button

5. **Duration Picker**
   - Add duration selection (30min, 1h, 2h)
   - Calculate end time automatically
   - Show time range preview

6. **Conflict Detection**
   - Check for existing appointments
   - Show warning for conflicts
   - Suggest alternative times

## 📚 Related Documentation

- [shadcn/ui Calendar Documentation](https://ui.shadcn.com/docs/components/calendar)
- [React Day Picker](https://react-day-picker.js.org/)
- [date-fns Documentation](https://date-fns.org/)
- [Schedule Meeting Implementation](./SCHEDULE_MEETING_IMPLEMENTATION.md)
- [Meeting Date Sync](./MEETING_DATE_SYNC.md)

## 🔗 Dependencies

```json
{
  "react-day-picker": "^9.4.4",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.469.0"
}
```

## ✅ Conclusion

The DateTimePicker component provides a clean, reusable solution for date and time selection in the Lead Flow application. It follows shadcn/ui patterns, supports Portuguese localization, and offers an intuitive user experience. The component simplifies the scheduling flow and can be easily extended for future requirements.
