# Sprint 003 — Auditoria, histórico e continuidade

## Invariantes estruturais

- `MasterRecord.patientId` permanece único: um paciente possui no máximo um Prontuário Mestre.
- Registros operacionais guardam módulo, responsável, criador ou alterador, status, versão e timestamps.
- Conteúdo clínico usa versões append-only em `MasterRecordEntry`.
- Versões anteriores permanecem ligadas por `previousEntryId` e agrupadas por `aggregateId`.
- Avaliações e planos não são apagados em cascata.
- O histórico genérico é preservado em `RecordVersion`.
- Alterações campo a campo são registráveis em `AuditEvent` e `AuditChange`.

## Fonte única e reutilização

`Patient` continua sendo a fonte cadastral única. `MasterRecordDataReference` possui a restrição única `(masterRecordId, category, key)` e aponta para a entrada corrente de um dado antropométrico, clínico ou funcional. Módulos autorizados consultam essa referência em vez de criar cópias.

## Continuidade do atendimento

`MasterRecordContinuity` é único por prontuário e armazena:

- última etapa concluída;
- usuário responsável;
- data da última atividade;
- próxima etapa sugerida;
- origem manual ou de workflow da sugestão;
- status e versão.

`ContinuityStep` representa etapas pendentes, em andamento, concluídas, ignoradas ou bloqueadas, mantendo autoria, atualização, módulo e versão.

## Permissões

O módulo `AUDIT` foi adicionado ao catálogo. O papel de Saulo Xavier Vitorino continua com acesso total. O papel de Maria de Lourdes Gomes continua com acesso geral, mas sem módulos marcados como exclusivos de Nutrição e com negações explícitas no Plano Alimentar.

## Limite de enforcement

O schema, as chaves estrangeiras restritivas e os contratos append-only evitam exclusão pelo fluxo projetado da aplicação. Bloquear também comandos `DELETE` executados diretamente por administradores no PostgreSQL exige uma política operacional adicional, como triggers append-only ou revogação de privilégios da role da aplicação. Essa decisão deve ser aprovada junto com a estratégia de infraestrutura e migrações.
