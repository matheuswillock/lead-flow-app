# SPEC futura — Assinatura qualificada ICP-Brasil

> **Não incluída na implementação atual.** Este documento é referência para uma fase futura e não autoriza instalação de SDK, criação de coluna de provedor ou alteração do fluxo de aceite eletrônico.

## Objetivo futuro

Permitir que um conjunto documental seja assinado com certificado ICP-Brasil no padrão PAdES, preservando o PDF original, o PDF assinado, dados do certificado, cadeia de confiança, políticas, carimbo de tempo e relatório de validação.

## Estratégia de provedor

1. Executar prova de conceito com o **Assinador de Referência do ITI**, descrito pelo ITI como API gratuita para cidadãos e fornecedores de plataformas.
2. Solicitar acesso e documentação atual pelo canal oficial `cgicp@iti.gov.br`.
3. Manter D4Sign como fallback comercial se a solução do ITI não atender experiência web, certificados em nuvem/A3, disponibilidade, suporte ou operação em produção.
4. Implementar ambos somente atrás de `IQualifiedSignatureProvider`; DTOs de provedor não entram no domínio.

Fontes oficiais: [Carta de Serviços do ITI](https://www.gov.br/iti/pt-br/servicos/carta-de-servicos), [artefatos de assinatura digital](https://www.gov.br/iti/pt-br/assuntos/repositorio/artefatos-de-assinatura-digital) e [documentos principais ICP-Brasil](https://www.gov.br/iti/pt-br/assuntos/legislacao/documentos-principais/).

## Prova de conceito obrigatória

A prova deve confirmar:

- elegibilidade de plataforma privada e processo de credenciamento;
- ambientes de homologação e produção;
- assinatura PAdES conforme políticas vigentes;
- suporte a e-CPF do representante e certificados A1, A3 e em nuvem;
- retorno/callback seguro e correlação de transação;
- obtenção do PDF assinado e relatório técnico;
- validação de cadeia, revogação e carimbo de tempo;
- limites, disponibilidade, suporte, continuidade e tratamento de dados;
- experiência em desktop e mobile sem entrega de chave privada ao Corretor Studio.

O ITI deve ser aprovado se cumprir todos os requisitos obrigatórios e suportar operação de produção documentada. Se algum requisito crítico falhar, a implementação usa o adapter D4Sign.

## Arquitetura futura

```ts
interface IQualifiedSignatureProvider {
  createEnvelope(input: CreateQualifiedEnvelopeInput): Promise<QualifiedEnvelope>
  addSigner(input: AddQualifiedSignerInput): Promise<void>
  requestSignature(envelopeId: string): Promise<{ signerUrl: string }>
  getStatus(envelopeId: string): Promise<QualifiedEnvelopeStatus>
  downloadSignedDocument(envelopeId: string): Promise<Uint8Array>
  downloadEvidence(envelopeId: string): Promise<Uint8Array | null>
  verifyCallback(rawBody: Uint8Array, headers: Headers): Promise<VerifiedProviderEvent>
}
```

Estados: `preparing`, `awaiting_signature`, `signed_pending_validation`, `completed`, `rejected`, `expired` e `failed`.

## Fluxo futuro

1. Gerar um PDF combinado e imutável antes da assinatura.
2. Calcular o SHA-256 original e criar envelope.
3. Exigir e-CPF do representante por padrão; e-CNPJ somente mediante decisão jurídica.
4. Redirecionar para a experiência segura do provedor.
5. Validar callback, consultar status autoritativo e persistir o evento idempotentemente.
6. Baixar PDF assinado e evidência, calcular novos hashes e validar certificado/política.
7. Concluir somente após validação; então liberar recuperação de senha.
8. Reconciliar envelopes pendentes por cron.

O Corretor Studio nunca recebe ou armazena `.pfx`, senha de certificado, chave privada ou controle direto de token A3.

## Dados futuros

- modo e provedor;
- IDs externos e status;
- paths e hashes do PDF original/assinado;
- subject, emissor, serial/fingerprint e validade do certificado;
- algoritmo, OID da política, instante da assinatura e carimbo de tempo;
- resultado/data da validação;
- path/hash do relatório do provedor;
- eventos únicos por `(provider, eventId)`.

Esses campos serão introduzidos somente quando a fase ICP-Brasil for aprovada. A migração converterá o aceite atual em modalidade `electronic` sem alterar evidências históricas.

## Segurança e operação futura

- Segredos apenas no servidor e callbacks verificados sobre o corpo bruto.
- Consulta autoritativa após callback; payload isolado não conclui assinatura.
- Sem downgrade silencioso para aceite eletrônico.
- Envelope expirado/rejeitado é preservado; nova tentativa cria outro envelope.
- Atualizações normativas PAdES devem ser configuráveis sem reescrever o domínio.
- Retenção e transferência de dados para o provedor exigem revisão jurídica/LGPD.

## Critérios de conclusão futura

- Documento validado por mecanismo compatível com as políticas vigentes da ICP-Brasil.
- Certificado inválido, vencido, revogado ou incompatível não libera acesso.
- Callbacks duplicados ou fora de ordem não alteram incorretamente o estado.
- Reconciliação recupera eventos perdidos.
- Chaves privadas nunca entram na infraestrutura do Corretor Studio.
- O pipeline do backoffice diferencia aguardando assinatura, validando e concluído.
