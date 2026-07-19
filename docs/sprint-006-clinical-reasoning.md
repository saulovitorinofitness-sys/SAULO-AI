# Sprint 006 — Motor de Decisão Clínica

## Entidades

- `ClinicalReasoningSession`: sessão única por atendimento.
- `ClinicalFinding`: achado flexível com categoria e chave de deduplicação.
- `ClinicalPriority`: prioridade única por achado.
- `ClinicalObjective`: objetivo principal ou secundário.
- `ClinicalDecision`: decisão, motivo, profissional, data e evidências.
- `TherapeuticStrategy`: descrição estratégica sem dieta ou treino.
- `ClinicalEvidence`: catálogo científico reutilizável com tipo e nível.
- `ClinicalAlert`: alerta ligado à sessão e opcionalmente a um achado.

Todas as entidades clínicas específicas pertencem a `ClinicalReasoningSession`, que pertence a `Attendance`, que pertence ao `MasterRecord`. Não existe um novo vínculo com paciente nem armazenamento paralelo de informações do prontuário.

## Proteções contra duplicação

- uma sessão por atendimento;
- uma prioridade por achado;
- chaves de deduplicação por sessão para achados, objetivos e alertas;
- chaves idempotentes por sessão para decisões e estratégias;
- chave global única para cada evidência;
- associação única entre decisão e evidência.

## Serviços

- contexto do profissional autenticado;
- relógio para timestamps automáticos;
- autorização para abrir e contribuir em sessões;
- classificador de prioridade por contrato.

`ClinicalPriorityClassifierService` não possui implementação. A origem `AUTOMATED_SERVICE` apenas reserva o ponto de integração para um mecanismo futuro sem definir regras, pesos, cálculos ou IA.

## Casos de uso

- abertura idempotente da sessão;
- registro de achado e solicitação de classificação;
- definição de objetivo principal e objetivos secundários;
- registro reutilizável de evidência;
- registro de decisão com uma lista não vazia de evidências;
- definição de estratégia terapêutica;
- emissão de alerta clínico.

Os repositórios `createWithPriority` e `createWithEvidence` representam gravações atômicas dos respectivos agregados.
