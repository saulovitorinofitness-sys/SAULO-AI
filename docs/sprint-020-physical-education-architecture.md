# Sprint 020 — Arquitetura do Módulo de Educação Física

## 1. Escopo e decisões da Sprint

Esta Sprint define a arquitetura do módulo de Educação Física sem criar telas, rotas, migrations, modelos Prisma ou regras clínicas. A implementação futura deve evoluir o monolito modular existente e preservar as seguintes decisões:

- `Patient` continua sendo a fonte única dos dados cadastrais.
- Todo dado clínico, físico, funcional, postural ou de treinamento pertence ao mesmo `MasterRecord`.
- Novas versões clínicas entram por `MasterRecordEntry`; não se sobrescreve histórico consolidado.
- Avaliações e planos especializam uma entrada do prontuário, como já ocorre com `PhysicalAssessmentRecord`, `PosturalAssessmentRecord` e `WorkoutPlanRecord`.
- O atendimento continua sendo orquestrado por `Attendance`, `MasterRecordContinuity` e pela linha do tempo existente.
- Exercícios pertencem ao domínio central `EXERCISE`; o Plano de Treino guarda referências e a prescrição, não cópias do catálogo.
- Motor de Prescrição e Motor de Decisão geram sugestões explicáveis. Aprovação e alteração continuam exclusivamente profissionais.
- Relatórios e documentos utilizam `Report` e `Deliverable`, vinculados ao mesmo prontuário.
- Integrações externas serão adaptadores de entrada; dados brutos externos não se tornam automaticamente dados clínicos validados.

Nenhuma estrutura proposta neste documento está autorizada para migration antes da validação de contratos, permissões, cardinalidades e política de retenção em uma Sprint específica.

## 2. Arquitetura encontrada

### 2.1 Núcleo canônico

| Responsabilidade | Estrutura existente | Decisão para Educação Física |
| --- | --- | --- |
| Cadastro | `Patient` | Referenciar; nunca duplicar nome, nascimento, contato ou sexo. |
| Prontuário | `MasterRecord` | Raiz única de todos os módulos. |
| Versionamento clínico | `MasterRecordEntry` | Registrar versões de anamnese, avaliações, objetivos e planos. |
| Dado corrente | `MasterRecordDataReference` | Apontar para a versão clínica vigente por categoria e chave. |
| Atendimento | `Attendance` | Contexto de execução do fluxo profissional. |
| Continuidade | `MasterRecordContinuity` e `ContinuityStep` | Controlar próxima etapa sem estado paralelo. |
| Auditoria | `AuditEvent`, `AuditChange` e `RecordVersion` | Preservar autor, alteração, versão e motivo. |
| Permissões | `SystemModule`, roles e overrides | Aplicar autorização no serviço e antes da serialização. |

### 2.2 Capacidades já preparadas

- `PhysicalAssessmentRecord` e módulo público `physical-assessment`.
- `PosturalAssessmentRecord` e módulo público `postural-assessment`.
- `WorkoutPlanRecord` e módulo público `workout-plan`.
- `ClinicalReasoningSession`, objetivos, prioridades, decisões, estratégias, alertas e evidências.
- `ClinicalEvolutionSession`, comparações, aderência, histórico de protocolo e fatores associados.
- `AthleteProgressProfile` e referências de performance.
- `Report` e `Deliverable`.
- `WORKOUT_PLAN`, `PHYSICAL_ASSESSMENT`, `POSTURAL_ASSESSMENT`, `CLINICAL_REASONING`, `CLINICAL_EVOLUTION` e `DELIVERABLES` no sistema de módulos.
- Tipos de consulta `PHYSICAL_ASSESSMENT`, `POSTURAL_ASSESSMENT` e `TRAINING`.
- Dimensões de evolução para avaliação física, avaliação postural, performance e aderência ao treinamento.

### 2.3 Padrão da camada de aplicação

O projeto possui dois níveis que devem continuar separados:

1. `src/modules/*`: domínio, portas, repositórios, serviços abstratos e casos de uso.
2. `src/features/*`: composição da experiência, DTOs de leitura, gateways e adaptadores substituíveis.

As futuras páginas do App Router apenas resolvem contexto, autorização e composição. Regras de negócio não devem ficar em `page.tsx` nem em componentes React.

### 2.4 Padrão dos entregáveis

Podem ser reutilizados:

- `DocumentLayout`;
- `DocumentFooter`;
- `DocumentSection`;
- `DocumentClosingPage`;
- `ProfessionalSignature`;
- barra de prévia, exportação cliente e estratégia de impressão/PDF existentes.

`DocumentHeader` contém texto específico do Plano Alimentar. Antes do primeiro documento de Educação Física, deve receber uma variação tipada para título, categoria profissional e metadados, sem quebrar o entregável atual e sem duplicar o template A4.

### 2.5 Catálogo de exercícios encontrado

A Central de Dados já possui:

- domínio discriminado `EXERCISE`;
- metadados comuns, categoria, tags, origem, autoria e histórico;
- atributos de grupo muscular, equipamento, nível, objetivo, execução, variações, contraindicações e mídia futura;
- filtro de visibilidade `PHYSICAL`;
- permissão de leitura para Maria sem exposição dos domínios exclusivos de Nutrição.

Essa estrutura é hoje demonstrativa e local. Ela é o ponto de migração para um Banco de Exercícios persistente; não deve ser criado outro catálogo em paralelo.

## 3. Fluxo de atendimento projetado

```text
Patient
  └─ MasterRecord
      └─ Attendance
          ├─ Anamnese Esportiva
          ├─ Avaliação Física
          ├─ Avaliação Postural
          ├─ Testes Funcionais
          ├─ Objetivos
          ├─ Motor de Decisão Assistido
          ├─ Sugestão do Motor de Prescrição
          ├─ Plano de Treino em revisão
          ├─ Aprovação profissional
          ├─ Entregável
          ├─ Evolução
          └─ Reavaliação → nova Attendance / novas MasterRecordEntry
```

### 3.1 Pré-condições e resultados

| Etapa | Entrada mínima | Resultado referenciado |
| --- | --- | --- |
| Anamnese Esportiva | paciente e atendimento | entrada versionada no `MasterRecord` |
| Avaliação Física | atendimento e autorização | `PhysicalAssessmentRecord` |
| Avaliação Postural | atendimento e autorização | `PosturalAssessmentRecord` |
| Testes Funcionais | protocolo e atendimento | resultados vinculados à entrada do prontuário |
| Objetivos | achados e decisão profissional | `ClinicalObjective` |
| Motor de Decisão | referências existentes | alertas, prioridades e sugestões explicáveis |
| Motor de Prescrição | objetivos e dados aprovados | sugestão não aprovada |
| Plano de Treino | sugestão aceita ou criação manual | `WorkoutPlanRecord` em rascunho |
| Aprovação | plano revisado e profissional autorizado | versão aprovada e autoria |
| Entregável | versão aprovada | `Deliverable` ligado ao prontuário e ao plano |
| Evolução | execução e nova avaliação | `ClinicalEvolutionSession` e referências |
| Reavaliação | novo atendimento | novas versões, sem substituir histórico |

### 3.2 Estados previstos do Plano de Treino

Os estados devem seguir a filosofia do Plano Alimentar:

- `DRAFT`;
- `PENDING_REVIEW`;
- `APPROVED`;
- `REJECTED`;
- `NEEDS_UPDATE`;
- `ARCHIVED`, quando aplicável ao ciclo de retenção.

Regras arquiteturais:

- nenhuma sugestão nasce aprovada;
- somente versão aprovada produz entregável definitivo;
- edição de versão aprovada cria revisão e retorna a estado de revisão;
- aprovação registra profissional, data e referência da versão analisada;
- mudança relevante de objetivo ou avaliação não altera o plano silenciosamente: marca `NEEDS_UPDATE`;
- entregável referencia a versão aprovada, não “o plano atual” de forma ambígua.

## 4. Módulos projetados

### 4.1 Anamnese Esportiva

Responsável por registrar somente os campos que forem aprovados na Sprint de implementação. Deve reutilizar dados clínicos existentes por referência e guardar apenas informações específicas da prática esportiva que não existam no Prontuário Mestre.

Portas futuras:

- `SportsAnamnesisRepository`;
- `GetSportsAnamnesisUseCase`;
- `SaveSportsAnamnesisDraftUseCase`;
- `FinalizeSportsAnamnesisUseCase`.

### 4.2 Avaliação Física

Evolução do `PhysicalAssessmentRecord`. Deve conservar a entrada versionada, autoria, atendimento, data e protocolo utilizado. Cálculos aprovados futuramente ficam em serviços puros e únicos.

### 4.3 Avaliação Postural

Evolução do `PosturalAssessmentRecord` e da coleta atual. Evidências visuais futuras devem ser armazenadas por referência segura; conclusões profissionais permanecem separadas da mídia bruta.

### 4.4 Testes Funcionais

Separa:

- definição do teste/protocolo, na Central de Dados;
- aplicação do teste, ligada ao atendimento;
- resultado registrado, ligado ao `MasterRecordEntry`;
- interpretação profissional, quando aprovada, ligada ao raciocínio clínico.

O catálogo não guarda resultado do paciente.

### 4.5 Banco de Exercícios

É a evolução persistente do domínio `EXERCISE` da Central de Dados. Deve fornecer busca paginada, filtros, sinônimos e referências estáveis. Não contém séries, repetições, carga ou decisão de prescrição.

### 4.6 Motor de Prescrição

Serviço de sugestão assistida, isolado da interface e da persistência final:

```text
TrainingPrescriptionContext
  → TrainingPrescriptionRuleService
  → TrainingSuggestion
  → revisão profissional
  → WorkoutPlanDraft
```

O contexto recebe somente referências autorizadas e snapshots versionados. A saída deve registrar:

- versão do motor;
- dados utilizados;
- regras acionadas;
- itens não avaliados por falta de dados;
- data da análise;
- status `PENDING_REVIEW`.

Não diagnostica, não aprova e não modifica plano existente.

### 4.7 Plano de Treino

Evolução do `WorkoutPlanRecord`. O conteúdo deve representar:

```text
Plano
  └─ Divisões / blocos
      └─ Sessões
          └─ Exercícios prescritos
              ├─ referência do exercício
              ├─ séries
              ├─ repetições ou duração
              ├─ carga
              ├─ RPE
              ├─ descanso
              ├─ observações
              └─ progressão planejada
```

O exercício é referenciado pelo ID canônico. Dados essenciais de exibição podem integrar um snapshot versionado do plano para preservar o documento histórico, mas não substituem a relação com o catálogo.

### 4.8 Motor de Evolução

Deve reutilizar `ClinicalEvolutionSession`, `EvolutionComparison`, `TreatmentAdherence`, `ProtocolHistory` e `AthleteProgressProfile`.

Fontes previstas:

- sessões realizadas;
- carga e volume registrados;
- frequência e aderência;
- avaliações físicas e posturais;
- testes funcionais;
- referências de composição corporal e perimetria.

Classificações permanecem delegadas ao contrato `EvolutionClassificationService`; não devem ser implementadas dentro de componentes.

### 4.9 Motor de Decisão

Reutiliza o padrão do Motor de Decisão Nutricional:

- agregador de dados;
- contratos de comparação;
- regras puras versionadas;
- alertas;
- prioridades;
- sugestões;
- explicação com origem e dados utilizados;
- registro de análise.

Blocos previstos:

- resumo do contexto físico;
- objetivos;
- avaliações;
- testes funcionais;
- plano atual;
- aderência e evolução;
- inconsistências;
- alertas;
- prioridades;
- sugestões assistidas.

Não há regra clínica definida nesta Sprint.

### 4.10 Entregáveis

Documentos previstos:

- Plano de Treino Premium;
- Relatório de Evolução;
- Avaliação Física;
- Avaliação Postural;
- Comparativo de Reavaliação.

Todos usam `Deliverable`, o mesmo `MasterRecord`, versão do registro de origem e os componentes A4 compartilhados.

### 4.11 Histórico e Progressão

Histórico é composto por versões e eventos existentes, não por uma cópia agregada:

- `MasterRecordEntry` para revisões clínicas;
- `AttendanceTimelineEvent` para o atendimento;
- `ProtocolHistory` e `ProtocolChange` para alterações planejadas;
- `ClinicalEvolutionSession` para comparação entre períodos;
- `TrainingExecution` futuro para o realizado.

Progressão planejada pertence ao Plano de Treino. Progressão realizada pertence ao registro de execução/evolução. As duas não podem compartilhar o mesmo campo mutável.

## 5. Dados compartilhados entre Nutrição e Educação Física

| Informação | Fonte canônica | Consumo pela Educação Física |
| --- | --- | --- |
| Nome, nascimento, sexo e contatos | `Patient` | leitura autorizada |
| Peso, altura e IMC | referência antropométrica vigente | leitura por ID da entrada |
| Bioimpedância | `BioimpedanceRecord` | leitura por referência |
| Perimetria | `PerimetryRecord` | leitura e comparação referencial |
| Objetivos | `ClinicalObjective` | leitura; objetivo específico novo é outra versão |
| Patologias, medicamentos e restrições | entradas clínicas/anamnese | leitura autorizada, sem cópia |
| Exames | entrada correspondente no prontuário | leitura autorizada, sem interpretação automática |
| Estratégia nutricional | entrada/módulo de Nutrição | somente se o usuário tiver autorização nutricional |
| Plano alimentar | `MealPlanRecord` aprovado | somente referência e acesso autorizado |
| Histórico clínico | `MasterRecordEntry` e continuidade | consulta paginada |
| Avaliações físicas e posturais | registros especializados | origem para decisão e evolução |
| Plano de treino | `WorkoutPlanRecord` aprovado | origem para execução e entregável |

Compartilhar o `MasterRecord` não elimina autorização. Em especial, Maria não deve receber payloads exclusivos de Nutrição; filtros devem ocorrer no servidor e antes da serialização.

## 6. Banco de Exercícios projetado

### 6.1 Agregado canônico

O futuro agregado `Exercise` deverá suportar:

- identidade, nome oficial e nome normalizado;
- descrição e fonte;
- categoria e tipo;
- grupo muscular principal;
- sinergistas;
- equipamentos;
- nível;
- execução profissional;
- unilateral ou bilateral;
- plano de movimento;
- cadeia cinética;
- contraindicações registradas;
- variações;
- sinônimos;
- imagem e vídeo por referência;
- ativo/inativo;
- autoria, revisão e timestamps.

### 6.2 Separações obrigatórias

- `Exercise`: definição reutilizável.
- `ExerciseVariation`: relação entre exercícios, sem copiar cadastro.
- `ExerciseMedia`: metadado e storage seguro.
- `ExerciseContraindication`: informação catalogada e rastreável, sem inferência automática.
- `WorkoutExercisePrescription`: decisão aplicada ao paciente.
- `TrainingExecutionItem`: execução efetivamente informada.

### 6.3 Busca

A porta `ExerciseSearchRepository` deverá oferecer busca server-side por nome, sinônimo, categoria, grupo muscular, equipamento, nível, tipo e fonte, com paginação. A normalização deve ignorar caixa, acentos e espaços excedentes, usando a mesma filosofia do Banco de Alimentos.

## 7. Entidades previstas

As entidades abaixo são candidatas para Sprints futuras, não models criados nesta Sprint.

| Entidade | Vínculo principal | Finalidade |
| --- | --- | --- |
| `SportsAnamnesisRecord` | `MasterRecordEntry` | dados esportivos aprovados |
| `FunctionalTestDefinition` | Central de Dados | definição reutilizável do teste |
| `FunctionalAssessmentRecord` | `MasterRecordEntry` e `Attendance` | aplicação de testes |
| `FunctionalTestResult` | avaliação funcional | resultado registrado |
| `Exercise` | Central de Dados | exercício canônico |
| `ExerciseSynonym` | exercício | busca alternativa |
| `ExerciseMuscle` | exercício | principal ou sinergista |
| `ExerciseEquipment` | exercício | equipamento requerido/opcional |
| `ExerciseVariation` | exercício origem/destino | variação rastreável |
| `ExerciseContraindication` | exercício | restrição catalogada |
| `ExerciseMedia` | exercício | vídeo ou imagem por referência |
| `TrainingPrescriptionAnalysis` | atendimento e referências | execução versionada do motor assistido |
| `TrainingSuggestion` | análise | proposta pendente de revisão |
| `WorkoutPlanApproval` | versão do plano | aprovação, rejeição e autoria |
| `WorkoutPlanBlock` | `WorkoutPlanRecord` | divisão ou bloco |
| `WorkoutSession` | bloco | sessão planejada |
| `WorkoutExercisePrescription` | sessão e exercício | prescrição |
| `WorkoutProgressionRule` | prescrição ou bloco | progressão planejada |
| `TrainingExecution` | atendimento/plano | sessão realizada |
| `TrainingExecutionItem` | execução/prescrição | carga, volume e RPE realizados |
| `PhysicalDecisionAnalysis` | atendimento | alertas e sugestões explicáveis |
| `ExternalProviderConnection` | usuário/paciente autorizado | vínculo futuro com provedor |
| `ExternalActivityImport` | conexão | lote bruto e rastreabilidade |
| `ExternalActivityReference` | entrada validada | associação após revisão |

Antes de normalizar o conteúdo JSON de `WorkoutPlanRecord`, deve-se avaliar volume de consultas, necessidade de edição transacional e imutabilidade dos snapshots. A estrutura atual não deve ser removida de forma destrutiva.

## 8. Relacionamentos e dependências

```text
Patient 1 ── 1 MasterRecord
MasterRecord 1 ── N MasterRecordEntry
Attendance 1 ── N MasterRecordEntry

MasterRecordEntry 1 ── 0..1 SportsAnamnesisRecord
MasterRecordEntry 1 ── 0..1 PhysicalAssessmentRecord
MasterRecordEntry 1 ── 0..1 PosturalAssessmentRecord
MasterRecordEntry 1 ── 0..1 FunctionalAssessmentRecord
MasterRecordEntry 1 ── 0..1 WorkoutPlanRecord

WorkoutPlanRecord 1 ── N WorkoutPlanBlock
WorkoutPlanBlock 1 ── N WorkoutSession
WorkoutSession 1 ── N WorkoutExercisePrescription
WorkoutExercisePrescription N ── 1 Exercise

WorkoutPlanRecord 1 ── N TrainingExecution
TrainingExecution 1 ── N TrainingExecutionItem

MasterRecord 1 ── N Deliverable
MasterRecord 1 ── N ClinicalEvolutionSession
```

Dependências permitidas:

- composição web → contratos públicos das features;
- feature → módulos públicos e portas;
- caso de uso → repositórios e serviços abstratos;
- adaptador Prisma → Prisma;
- documento → DTO imutável do entregável.

Dependências proibidas:

- componente → Prisma;
- plano → mock da Central de Dados;
- exercício → dados do paciente;
- integração externa → atualização clínica automática;
- Educação Física → arquivos internos da feature de Nutrição;
- entregável → estado volátil do editor.

## 9. Componentes reutilizados e componentes futuros

### 9.1 Reutilização direta

- `PatientNavigation`;
- `PatientBreadcrumb`;
- `MasterRecordTabs`;
- cabeçalho contextual do paciente;
- `PageHeading`, `PageState`, loaders e estados vazios;
- `Card`, `Badge`, `Button`, formulários, tabela e accordion;
- componentes de autoria e auditoria da coleta;
- stepper e barra responsiva de ações;
- painel de alertas e padrões de explicação do Motor de Decisão;
- layout, seções, rodapé, fechamento, assinatura e exportação de documentos.

### 9.2 Componentes novos previstos

Somente quando as telas forem autorizadas:

- `SportsAnamnesisWorkspace`;
- `FunctionalAssessmentWorkspace`;
- `FunctionalTestCard`;
- `ExerciseSearch`;
- `ExerciseDetails`;
- `TrainingPrescriptionWorkspace`;
- `WorkoutPlanWorkspace`;
- `WorkoutSessionEditor`;
- `WorkoutExerciseEditor`;
- `WorkoutPlanComparison`;
- `PhysicalDecisionWorkspace`;
- `TrainingEvolutionWorkspace`;
- `WorkoutPlanDocument`;
- `PhysicalAssessmentDocument`;
- `PosturalAssessmentDocument`;
- `EvolutionComparisonDocument`.

Não criar um design system exclusivo de Educação Física.

## 10. Integrações futuras

### 10.1 Limite arquitetural

Apple Watch, Garmin, Coros, Polar, Strava e TrainingPeaks entram por adaptadores independentes:

```text
Provider API
  → ProviderAdapter
  → ExternalActivityImport (bruto e imutável)
  → normalização técnica
  → fila de revisão profissional
  → MasterRecordEntry / referência validada
```

### 10.2 Regras de segurança

- consentimento explícito e revogável;
- tokens criptografados fora do payload clínico;
- escopos mínimos;
- idempotência por provedor e atividade;
- timezone e unidade originais preservados;
- dado bruto separado do dado validado;
- nenhuma métrica externa altera plano, objetivo ou diagnóstico;
- exclusão da conexão não apaga histórico clínico validado sem política aprovada;
- falha do provedor não bloqueia o atendimento.

## 11. Permissões

O desenho deve reutilizar `AccessAction`, roles e overrides:

- Saulo Xavier Vitorino: acesso integral.
- Maria de Lourdes Gomes: acesso às capacidades compartilhadas e de Educação Física, mantendo bloqueio integral dos módulos exclusivos de Nutrição.
- O front-end oculta ações não autorizadas, mas o serviço valida novamente.
- Motores, aprovação, exportação e administração do Banco de Exercícios exigem ações específicas.
- Acesso ao mesmo prontuário não autoriza automaticamente a leitura de payload nutricional.

Inicialmente, usar os módulos existentes sempre que a responsabilidade coincidir. Novas chaves de módulo somente devem ser criadas quando houver necessidade real de autorização independente.

## 12. Riscos identificados

1. **Duplicação do Banco de Exercícios:** a Central de Dados já possui `EXERCISE`; criar outro catálogo quebraria referências.
2. **Conteúdo JSON excessivo:** `WorkoutPlanRecord.content` é flexível, mas pode dificultar busca, progressão e edição concorrente.
3. **Mistura entre planejado e realizado:** carga prescrita não pode ser sobrescrita pela carga executada.
4. **Acoplamento com Nutrição:** compartilhamento deve ocorrer por contratos e referências, nunca por importação interna de features.
5. **Autorização de dados compartilhados:** Maria pode acessar Educação Física, mas não payloads nutricionais adjacentes.
6. **Inferência indevida:** contraindicações e dados de dispositivos não podem produzir bloqueios ou prescrições automáticas sem regra aprovada.
7. **Mídia sensível:** imagens posturais e vídeos exigem consentimento, storage seguro e política de retenção.
8. **Versionamento do plano:** entregáveis e execuções precisam apontar para a versão aprovada correta.
9. **Granularidade prematura do Prisma:** normalização extensa antes do editor real pode cristalizar um modelo inadequado.
10. **Performance:** histórico e telemetria podem crescer rapidamente; consultas devem ser paginadas e orientadas a projeções.
11. **Dados demonstrativos existentes:** Performance Endurance e Central de Dados não podem virar fallback silencioso para pacientes reais.
12. **Integrações externas:** unidades, fusos, duplicidade e indisponibilidade de provedores exigem camada de importação isolada.

## 13. Ordem recomendada das próximas Sprints

### Sprint 021 — Contratos e persistência base

- validar campos mínimos da Anamnese Esportiva e dos Testes Funcionais;
- aprovar entidades e cardinalidades;
- definir repositórios, DTOs e autorização;
- criar migration segura somente após aprovação;
- integrar ao mesmo `MasterRecord`.

### Sprint 022 — Banco de Exercícios

- migrar o domínio `EXERCISE` da Central de Dados;
- implementar busca paginada e filtros;
- sinônimos, variações, equipamentos, músculos, mídia e fontes;
- manter cenário demonstrativo explicitamente isolado.

### Sprint 023 — Avaliações operacionais

- Anamnese Esportiva;
- Avaliação Física e Postural sobre os registros existentes;
- Testes Funcionais;
- persistência, auditoria e continuidade do atendimento.

### Sprint 024 — Plano de Treino

- editor de divisões, sessões e exercícios;
- séries, repetições, carga, RPE, descanso e observações;
- versionamento, estados, aprovação e vínculo com exercícios reais.

### Sprint 025 — Motor de Prescrição Assistido

- contratos explicáveis;
- sugestões determinísticas iniciais;
- revisão, rejeição e regeneração;
- nenhuma aprovação automática.

### Sprint 026 — Motor de Decisão da Educação Física

- agregação seletiva de dados;
- alertas, inconsistências, prioridades e sugestões;
- auditoria da análise;
- regras clínicas somente após aprovação específica.

### Sprint 027 — Evolução e Progressão

- execução de treinos;
- carga, volume, frequência e aderência;
- comparação física, funcional e postural;
- reutilização de `ClinicalEvolutionSession`.

### Sprint 028 — Entregáveis

- Plano de Treino Premium;
- avaliações e comparativos;
- reutilização do Motor de Entregáveis;
- vínculo imutável com versões aprovadas.

### Sprint 029 — Integrações externas

- consentimento e conexões;
- um provedor piloto;
- importação bruta, idempotência e revisão;
- nenhum impacto clínico automático.

### Sprint 030 — Validação operacional

- fluxo ponta a ponta;
- permissões de Saulo e Maria;
- persistência e auditoria;
- acessibilidade, responsividade e performance;
- retirada de mocks silenciosos antes do uso real.

## 14. Critérios arquiteturais de aceite para implementação futura

- o fluxo parte de um `patientId` real e resolve o mesmo `MasterRecord`;
- nenhuma entidade repete dados cadastrais ou clínicos canônicos;
- exercício é referenciado, não copiado como catálogo local;
- motor assistido registra versão, entradas e explicação;
- plano não é aprovado automaticamente;
- execução não altera a prescrição histórica;
- entregável referencia uma versão aprovada;
- autorização ocorre antes da serialização;
- mocks aparecem apenas em cenário demonstrativo explícito;
- toda tela futura é acessível por teclado e responsiva;
- integrações externas permanecem opcionais e isoladas.
