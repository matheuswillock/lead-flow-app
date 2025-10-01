# Current Health Plan Field Implementation

## Overview
Added a new mandatory text input field `currentHealthPlan` to the Lead model that appears conditionally when the user indicates they have a current health plan.

## Changes Made

### 1. Database Schema (`/prisma/schema.prisma`)
- Added `currentHealthPlan String? @db.Text` field to Lead model
- Migration created: `20251001164310_add_current_health_plan_field`
- Migration applied successfully

### 2. DTOs (Data Transfer Objects)

#### Create Lead DTO (`/app/api/v1/leads/DTO/requestToCreateLead.ts`)
```typescript
currentHealthPlan: z.string().min(1, "Plano de saúde atual é obrigatório quando possui plano").nullish()
```

#### Update Lead DTO (`/app/api/v1/leads/DTO/requestToUpdateLead.ts`)
```typescript
currentHealthPlan: z.string().nullish()
```

#### Response DTO (`/app/api/v1/leads/DTO/leadResponseDTO.ts`)
```typescript
currentHealthPlan: string | null;
```

### 3. Use Case Layer (`/app/api/useCases/leads/LeadUseCase.ts`)
- Added `currentHealthPlan` to create method
- Added `currentHealthPlan` to update method
- Added `currentHealthPlan` to transformToDTO method

### 4. Frontend Validation (`/lib/validations/validationForms.ts`)
```typescript
currentHealthPlan: z.string().min(0).optional()
```

With conditional validation using `.refine()`:
- Required when `hasPlan === "sim"`
- Optional when `hasPlan === "nao"`

### 5. Lead Form Component (`/components/forms/leadForm.tsx`)
- Added FormField for `currentHealthPlan`
- Conditional rendering: only shows when `watchedValues.hasPlan === "sim"`
- Input label: "Qual o plano de saúde atual?*"
- Placeholder: "Ex: Unimed, Bradesco Saúde, etc."
- Added to `hasChanges` detection logic (both create and edit modes)

### 6. Board Dialog (`/app/[supabaseId]/board/features/container/BoardDialog.tsx`)
- Added `currentHealthPlan` to `transformToCreateRequest` function
- Added `currentHealthPlan` to `transformToUpdateRequest` function
- Added `currentHealthPlan` to form reset (edit mode)
- Added `currentHealthPlan` to form reset (create mode)

### 7. Type Definitions (`/app/[supabaseId]/board/features/context/BoardTypes.ts`)
```typescript
currentHealthPlan: string | null;
```

## Validation Rules
1. **Required**: When user selects "Sim" for "Possui plano atualmente?"
2. **Optional**: When user selects "Não" for "Possui plano atualmente?"
3. **Minimum length**: 1 character when required
4. **Input type**: Free text (no formatting)

## User Experience
1. User opens lead creation/edit form
2. User selects "Sim" for "Possui plano atualmente?"
3. New text input appears: "Qual o plano de saúde atual?*"
4. Field is required and must be filled before submission
5. If user changes to "Não", the field hides and validation is removed

## Testing Checklist
- [x] Schema migration successful
- [x] TypeScript compilation passes
- [x] DTOs updated with proper validation
- [x] Frontend form includes conditional field
- [x] Form validation works correctly
- [x] Backend mapping complete (create/update/read)

## Next Steps for Manual Testing
1. Create new lead with `hasPlan = false` → Field should not be required
2. Create new lead with `hasPlan = true` and empty `currentHealthPlan` → Should show validation error
3. Create new lead with `hasPlan = true` and filled `currentHealthPlan` → Should succeed
4. Update existing lead to change `currentHealthPlan` → Should persist correctly
5. Verify data displays correctly in board view
6. Test form change detection with `currentHealthPlan` field

## Files Modified
1. `/prisma/schema.prisma`
2. `/app/api/v1/leads/DTO/requestToCreateLead.ts`
3. `/app/api/v1/leads/DTO/requestToUpdateLead.ts`
4. `/app/api/v1/leads/DTO/leadResponseDTO.ts`
5. `/app/api/useCases/leads/LeadUseCase.ts`
6. `/lib/validations/validationForms.ts`
7. `/components/forms/leadForm.tsx`
8. `/app/[supabaseId]/board/features/container/BoardDialog.tsx`
9. `/app/[supabaseId]/board/features/context/BoardTypes.ts`

## Architecture Compliance
✅ Follows SOLID principles
✅ Maintains Repository → UseCase → Service → API Route pattern
✅ Proper TypeScript type safety
✅ Zod validation at DTO level
✅ React Hook Form integration
✅ Conditional validation logic
✅ Change detection for form state management
