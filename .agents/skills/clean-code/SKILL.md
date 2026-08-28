---
name: clean-code
description: Apply the Corretor Studio Clean Code and SOLID checklist before technical brainstorming, implementation planning, code writing, or refactoring in this repository.
metadata:
  short-description: Clean Code and SOLID checklist
---

# Clean Code

Apply Clean Code and SOLID, adapted from `clean-code-javascript` for this repository's TypeScript, Next.js, and Prisma stack, to every technical proposal. This includes brainstorming and implementation planning, not only code that has already been written.

## When To Use

Use this skill before:

- Proposing an implementation plan, even when no code will be written yet.
- Naming a new variable, function, class, UseCase, Service, Repository, or Context.
- Writing or reviewing any frontend or backend function.
- Refactoring existing code.

## Meaningful Names

- Use pronounceable, searchable names without obscure abbreviations. Prefer `leadProfile` over `lp`.
- Name UseCases, Services, and Repositories after business intent, not implementation mechanics. Prefer `FinalizeLeadUseCase` over `ProcessUseCase2`.
- Use one word per concept inside the same module. Do not mix `get`, `fetch`, and `retrieve` for the same operation.
- Prefix booleans as questions, such as `isValid`, `hasAccess`, and `canEdit`.

## Small Functions

- A function should do one thing at one level of abstraction.
- Keep argument lists short. From three arguments onward, prefer a typed options object.
- Avoid boolean flag parameters that change behavior, such as `save(lead, true)`. Prefer separate functions or an explicit options object such as `{ silent: true }`.
- Avoid hidden side effects. A function named with `get` or `is` should not mutate state.
- Keep the project architecture cohesive: Route parses requests and maps status, UseCase orchestrates business rules, Service holds complex domain logic, Repository or Prisma handles data access.

## SOLID In This Project

- **SRP:** one UseCase covers one business use case. Services do not parse HTTP. Routes do not contain business rules.
- **OCP:** when adding a variation, such as a campaign channel or status type, prefer composition or strategy over a growing `if`/`else`/`switch`.
- **LSP:** concrete Service and Repository implementations must be substitutable through their interfaces without consumers checking concrete types.
- **ISP:** keep Service and Repository interfaces lean. Do not force consumers to depend on methods they do not use.
- **DIP:** UseCases depend on Service or Repository interfaces and must not call `prisma.*`, `$queryRaw`, or `$executeRaw` directly.

## DRY Without Over-Engineering

- Two or three simple similar lines do not justify a new abstraction.
- Do not create generic helpers or wrappers for a single hypothetical future use case.
- DRY means eliminating duplicated business knowledge or domain rules, not every repeated token.

## Error Handling

- New UseCases return `Output` from `lib/output/index.ts`.
- Do not swallow exceptions silently.
- Use descriptive error messages, never a standalone `"Erro"`.
- Use `console.error` for errors and `console.info` for flow logs, with stable route names such as `[LeadRoute][GET]`.

## Comments

- Add comments only when the reason is not obvious from the code: hidden constraints, specific workarounds, or non-trivial invariants.
- Do not comment the "what"; meaningful names should communicate that.

## Legacy Exceptions

Before planning or coding a change, check `.governance/ai-governance.config.json` for relevant Clean Code and SOLID allowlists, especially `dipPrismaInUseCaseAllowlist`.

If the requested change touches a file listed in a related legacy exception:

- Identify that during brainstorming or planning, before writing code.
- Include the refactor of the violation in the same scope.
- Remove the corresponding allowlist entry in the same change.
- If the requested scope is genuinely incompatible with the required refactor, raise the conflict explicitly to the user instead of silently skipping it.

## Before Finishing

For brainstorming or planning, review the proposal against this checklist before presenting it.

For implementation, run the repository's required validation sequence from `AGENTS.md`. Do not report the implementation as complete while any required validation command is failing.

## Compliance Checklist

- Names are self-explanatory and avoid obscure abbreviations.
- Each function does one thing at one level of abstraction.
- Functions have few parameters, with typed options objects from three onward.
- No boolean flag parameters change behavior.
- UseCases do not call Prisma directly.
- New variations use composition or strategy instead of a growing conditional.
- Service and Repository interfaces are lean and have concrete implementations.
- Removed duplication is business-rule duplication, not premature abstraction.
- Errors use `Output` and descriptive messages where the project architecture requires it.
- Comments explain why, not what.

## Anti-Patterns

Avoid:

- Mixing parsing, business rules, and I/O inside one function.
- God objects that accumulate unrelated responsibilities.
- Boolean flag parameters like `function save(data, isDraft)`.
- UseCases calling Prisma or raw SQL directly.
- Generic abstractions created for one hypothetical case.
- Comments that merely repeat function or variable names.
