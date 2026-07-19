# Arquitetura do SAULO AI

## Direcao arquitetural

O projeto comeca como um monolito modular em Next.js. Essa abordagem reduz a complexidade operacional inicial e preserva limites claros para que modulos possam evoluir ou ser extraidos no futuro, se houver necessidade comprovada.

## Limites principais

- `src/app`: composicao web e convencoes do App Router.
- `src/modules`: capacidades de negocio futuras, isoladas por modulo.
- `src/config`: leitura e validacao centralizada do ambiente.
- `src/lib`: adaptadores e infraestrutura compartilhada.
- `prisma`: schema e historico de migracoes do PostgreSQL.
- `src/generated`: artefatos gerados por ferramentas; nao devem ser editados manualmente.

## Regras de dependencia

1. A camada web pode consumir contratos publicos dos modulos.
2. Modulos podem consumir infraestrutura compartilhada por interfaces estreitas.
3. Um modulo nao acessa arquivos internos de outro modulo.
4. Codigo gerado nunca recebe regras de negocio.
5. Segredos ficam no ambiente e nunca no repositorio.

## Persistência modular

O schema Prisma está dividido por responsabilidade em `prisma/schema`. A separação organiza a evolução dos modelos, mas todos usam a mesma conexão PostgreSQL e a mesma transação quando necessário.

## Dado canônico do paciente

`Patient` é a fonte única dos dados cadastrais. Cada paciente pode possuir exatamente um `MasterRecord`, garantido pela restrição única em `patientId`. Os módulos registram conteúdo em `MasterRecordEntry` e referenciam o prontuário; eles não mantêm cópias de nome, contato ou data de nascimento.

O agregado cadastral inclui endereço e convênio únicos, além de coleções de telefones e contatos de emergência. O contrato `PatientAggregate` exige todos esses componentes e o identificador do Prontuário Mestre na mesma operação de cadastro.

Agenda, atendimento, avaliações, planos, relatórios e entregáveis navegam pelo `MasterRecord`. Apenas o módulo Pacientes publica a operação `register`; os demais módulos não possuem contrato para criar pacientes.

Essa organização permite que um registro feito por um profissional fique disponível ao outro imediatamente pela mesma fonte, condicionado apenas à autorização do módulo.

## Versionamento e autoria

Cada entrada do prontuário registra autor, módulo, data de ocorrência, agregado e revisão. Avaliações e planos especializam a entrada sem duplicar seus metadados. A estrutura está preparada para histórico, substituição e auditoria, mas nenhuma regra de interpretação clínica foi criada.

## Auditoria e retenção

Alterações clínicas são append-only: uma nova `MasterRecordEntry` preserva `aggregateId`, incrementa `revision` e referencia `previousEntryId`. `RecordVersion` mantém snapshots completos de outros registros versionados, enquanto `AuditEvent` e `AuditChange` registram autor original, responsável pela alteração, campos alterados, valores anterior e novo, data e motivo opcional.

As relações de avaliações e planos usam `onDelete: Restrict`. Os contratos públicos oferecem operações de anexação e consulta, sem métodos de exclusão de histórico.

## Continuidade

Cada prontuário pode possuir um único `MasterRecordContinuity`. Ele registra última etapa concluída, responsável, última atividade e próxima etapa sugerida. `ContinuityStep` preserva as etapas e seus estados. Sugestões podem ter origem `MANUAL` ou `WORKFLOW`; não existe origem de IA.

## Atendimento Inteligente

O termo “inteligente” representa uma orquestração determinística. `StartIntelligentAttendanceUseCase` recebe o tipo de consulta, obtém o profissional autenticado, carrega o Prontuário Mestre, verifica a continuidade, prepara um resumo referencial e cria o atendimento com uma linha do tempo ordenada.

`idempotencyKey` impede que a mesma solicitação crie dois atendimentos. Pendências referenciam `ContinuityStep` e o resumo referencia `MasterRecordEntry`; nenhum dos dois copia valores clínicos. `RecordAttendanceActivityUseCase` registra atividades posteriores pela identidade do registro original.

## Motor de Decisão Clínica

`ClinicalReasoningSession` possui relação um-para-um com `Attendance`. Como o atendimento referencia obrigatoriamente um único `MasterRecord`, achados, objetivos, decisões, estratégias e alertas permanecem sob a mesma raiz sem repetir `patientId` ou conteúdo do prontuário.

Prioridades são produzidas por um contrato `ClinicalPriorityClassifierService`; nenhuma implementação ou algoritmo faz parte da arquitetura atual. Evidências formam um catálogo reutilizável por chave única e são associadas às decisões por uma tabela de junção, evitando cópias de referências científicas.

## Continuidade e evolução clínica

`ClinicalEvolutionSession` referencia obrigatoriamente `Patient`, `MasterRecord`, `Attendance` e profissional. A sessão anterior é uma autorrelação única, formando uma sequência linear. O caso de uso de abertura confirma que paciente e atendimento compartilham o mesmo prontuário antes da persistência.

Comparações, adesões, respostas de protocolo, fatores associados e referências de atleta apontam para `MasterRecordEntry`; valores já registrados não são copiados. `EvolutionClassificationService` e `EvolutionDataReferenceService` são apenas contratos sem algoritmo.

As permissões foram separadas entre `CLINICAL_EVOLUTION` e `NUTRITION_EVOLUTION`. A segunda capacidade é marcada como restrita à Nutrição e possui negações explícitas para Maria de Lourdes Gomes.

## Reutilização canônica

Dados cadastrais continuam centralizados em `Patient`. Para dados antropométricos, clínicos e funcionais, `MasterRecordDataReference` fornece um índice canônico único por prontuário, categoria e chave, apontando para a versão corrente sem apagar as anteriores.

## Escopo atual

Foram configurados Next.js, TypeScript estrito, Tailwind CSS, Prisma ORM e PostgreSQL, além dos contratos e modelos do domínio. Não existem páginas, regras clínicas, integrações de IA ou funcionalidades de produto.
