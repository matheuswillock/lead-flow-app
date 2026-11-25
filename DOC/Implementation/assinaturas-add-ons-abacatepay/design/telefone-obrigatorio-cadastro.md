# Briefing: telefone obrigatório no cadastro de usuário e na adesão

**Status:** aprovado pelo responsável em 2026-11-24, sem alteração de escopo. Implementado: campo só no modo criar, texto de ajuda mantido, telefone repetido permitido no cadastro. O campo usa `max-lg:h-11` (44 px no celular) para manter a altura dos vizinhos no desktop.

## Decisão de produto

Telefone é obrigatório **no cadastro**, em dois pontos:

1. **Master novo** (checkout público e nova adesão).
2. **Usuário adicional** criado por um master ou manager delegado.

Não entra: `/set-password`, "esqueci a senha", edição de perfil já existente.

## Estado atual (verificado no código)

| Ponto | Servidor | Tela |
|---|---|---|
| Auto-checkout público (`selfCheckoutRequestSchema`) | exige 10 a 13 dígitos | já obrigatório |
| Checkout público da adesão (`BackofficeAdhesionService`, linha ~2548) | exige 10 ou 11 dígitos | já obrigatório |
| Signup e OAuth (`validateRegisterProfileRequest`) | exige | já obrigatório |
| **Nova adesão criada no backoffice** (`normalizeCommercialInput`) | aceita vazio | botão liberado com telefone vazio (`BackofficeAdhesionDialog`, linha ~447) |
| **Usuário adicional** (`CreateUserSchema`, `createAccountUser`) | não tem o campo | `UserFormDialog` não tem o campo |

## Superfície

- Usuário adicional: **app** (diálogo "Criar Novo Usuário" em `manager-users`). Modo **Operate**.
- Adesão: **backoffice** (diálogo de adesão). Modo **Operate**.

## Usuário

- Master ou manager delegado que cadastra alguém da própria equipe.
- Operador do backoffice que cria uma adesão a partir de um lead.

## Mudanças de tela

**`UserFormDialog` (só no modo criar):** novo campo "Telefone" entre "E-mail" e "Nível de acesso".
- `type="tel"`, `autoComplete="tel"`, placeholder `(11) 99999-9999`, máscara `maskPhone` de `lib/masks.ts`, igual a `components/forms/accountForm.tsx`.
- Obrigatório. Erros: "Telefone é obrigatório" e "Telefone inválido" (mínimo 10 dígitos).
- Ajuda abaixo: "Usamos para contato e cobranças desta licença."
- No modo editar o campo não aparece (editar perfil já existente fica fora).
- O valor segue o `FormItem`/`FormLabel`/`FormMessage` dos campos vizinhos. Sem token novo, sem ícone novo.

**`BackofficeAdhesionDialog`:** o campo "Telefone" já existe. Mudanças:
- A condição de envio (linha ~447) passa a exigir 10 ou 11 dígitos, sem aceitar vazio.
- O rótulo ganha o marcador de obrigatório usado nos outros campos obrigatórios do mesmo diálogo (a confirmar na leitura do arquivo; se não houver padrão, uso " *" como nos demais formulários do app).

## Estados

- Vazio ou curto: mensagem no próprio campo, botão de envio segue o comportamento atual de cada diálogo.
- Erro do servidor (telefone inválido): vai no tratamento de erro já existente de cada diálogo.
- Carregando e sucesso: sem alteração.

## Direção visual e acessibilidade

Reuso total de `Input`, `Form*` e `Label`. Alvo de toque: os controles do diálogo já são `h-9` a `h-11`; o novo campo usa `h-11` como `accountForm`. Contraste e foco herdados dos componentes. Português do Brasil.

## Fora de escopo e riscos

- Caminhos legados sem chamador na interface (`operators/payments/create`, `SubscriptionUpgradeUseCase.createOperatorPayment` e `CheckoutAsaasUseCase.createOperatorCheckout`): **também exigem telefone no servidor** (decisão posterior do responsável). O `PendingOperator` ganhou a coluna `phone` (migration `20261124120100_add-phone-pending-operator.sql`; o timestamp `20261124120000` já é usado pela develop, por isso o renome) e o telefone vai para o perfil quando o pagamento confirma. Pendências antigas ficam sem telefone.
- Usuários adicionais com cobrança pendente: o telefone vai no `payload` do `PendingAction`, sem migration. Ações pendentes criadas antes do deploy não têm telefone e continuam sendo concluídas sem ele.
- Cadastro de usuário do backoffice (staff): não alterado.
- Duplicidade de telefone: não bloqueio no cadastro do usuário adicional. A edição de perfil já recusa telefone usado por outro perfil, então quem tiver o mesmo número de outra pessoa encontrará esse erro ao editar o próprio telefone.

## Perguntas abertas

1. Aprovado o campo só no modo criar, sem mexer na edição de usuário?
2. Aprovado o texto de ajuda "Usamos para contato e cobranças desta licença."?
3. Telefone repetido entre usuários fica permitido no cadastro, como descrito acima?
