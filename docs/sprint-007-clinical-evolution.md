# Sprint 007 — Continuidade e Evolução Clínica

## Sessão de evolução

`ClinicalEvolutionSession` possui relações obrigatórias com paciente, Prontuário Mestre, atendimento e profissional. `attendanceId` é único, impedindo duas evoluções para a mesma consulta. `previousSessionId` também é único e forma uma sequência sem ramificações.

O caso de uso de abertura carrega as três raízes existentes e rejeita atendimentos cujo `masterRecordId` não corresponda ao prontuário do paciente.

## Comparação referencial

As 14 dimensões solicitadas são representadas por `EvolutionDimension`. Cada `EvolutionComparison` contém apenas referências para a entrada atual e anterior do prontuário. A resolução das referências e a classificação são contratos sem implementação:

- `EvolutionDataReferenceService`;
- `EvolutionClassificationService`.

As classificações disponíveis são `PROGRESS`, `PARTIAL_PROGRESS`, `STABLE`, `REGRESSION`, `PLATEAU` e `INSUFFICIENT_DATA`.

## Adesão

`TreatmentAdherence` agrega itens únicos por categoria. Cada `TreatmentAdherenceItem` aceita percentual decimal, classificação, observação e referência opcional à entrada original. As categorias alimentar, treinamento, cardio, hidratação, sono, suplementação e geral permanecem separadas.

## Protocolos

- `ProtocolHistory` registra protocolo, tipo, vigência, escolha, responsável, resposta e status.
- `ProtocolChange` é append-only e registra alteração, motivo, resposta referenciada, profissional e horário.
- `ProtocolDecision` registra a opção escolhida, justificativa, profissional, horário, evolução avaliada e evidências.
- `ProtocolDecisionEvidence` reutiliza o catálogo `ClinicalEvidence`.

Decisões e alterações nutricionais passam pela autorização `NUTRITION_EVOLUTION`.

## Fatores associados

`EvolutionAssociatedFactor` registra somente fator observado ou relatado, status, notas e referência de origem. Não existe campo de causalidade nem serviço que conclua causalidade.

## Perfil de atleta

`AthleteProgressProfile` é único por Prontuário Mestre. `AthleteProgressReference` representa fase, período competitivo, desempenho, carga, recuperação, composição corporal, resposta a protocolos e progressões/regressões exclusivamente por referência ao dado original.

## Permissões

- `CLINICAL_EVOLUTION`: acompanhamento geral, físico, funcional, postural e de treinamento.
- `NUTRITION_EVOLUTION`: funcionalidades e decisões exclusivas da Nutrição.

Saulo Xavier Vitorino mantém acesso total. Maria de Lourdes Gomes recebe negações explícitas para todas as ações de `NUTRITION_EVOLUTION`, além das restrições já existentes para Plano Alimentar.

## Decisões pendentes de infraestrutura

1. A consistência cruzada entre `patientId`, `masterRecordId` e o prontuário do atendimento é verificada pelo caso de uso. Impedir inserções inconsistentes feitas diretamente por SQL exigirá constraints compostas ou trigger na migração.
2. O percentual usa `Decimal(5,2)`. Restringi-lo fisicamente ao intervalo de 0 a 100 exige uma constraint `CHECK` criada na migração PostgreSQL.
