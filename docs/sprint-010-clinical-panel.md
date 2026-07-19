# Sprint 010 — Integração ao Prontuário e Painel Clínico

## Resultado

O Prontuário Mestre passou a consultar `ClinicalCollectionGateway` usando o `patientId` e o `attendanceId` já existentes. A seção Atendimento Atual apresenta estado, progresso, continuidade e apenas ações funcionais. O Painel Clínico Integrado consolida os mesmos registros da coleta, sem criar novos dados ou alterar domínio e Prisma.

## Rotas

- alterada: `/pacientes/[patientId]`
- alterada: `/pacientes/[patientId]/continuar`
- alterada: `/pacientes/[patientId]/atendimentos/[attendanceId]/coleta`
- criada: `/pacientes/[patientId]/atendimentos/[attendanceId]/painel-clinico`

O parâmetro `scenario` é temporário e exclusivo da validação mock. O parâmetro `step` preserva a etapa escolhida ao revisar ou corrigir a coleta.

## Cenários mock

- A — `complete`: Saulo registrou antropometria, bioimpedância e perimetria; Maria registrou a avaliação postural. A coleta está completa e o painel está disponível.
- B — `partial-saulo`: coleta parcial e ação Continuar coleta clínica.
- C — `mandatory-pending`: avaliação postural pendente e painel bloqueado.
- D — `integrity-missing`: coleta declarada completa com mineral obrigatório ausente; o painel definitivo permanece bloqueado.
- E — `previous-comparison`: coleta completa, profissional conectado Maria e comparação com perimetria anterior.
- adicionais: `not-started` e `maria-continuity` validam início e compartilhamento.

O cenário padrão do Prontuário Mestre e do Painel Clínico é `complete`.

## Continuidade no navegador

O adaptador mock usa `sessionStorage` para preservar etapas salvas, conclusão, confirmação do painel e encaminhamento enquanto a aba permanece aberta. O servidor continua usando seeds tipados durante renderização; componentes clientes reconciliam o estado persistido após a hidratação.

## Integridade objetiva

O painel verifica apenas:

- etapa obrigatória incompleta;
- valor obrigatório ausente;
- registro concluído sem autoria;
- ausência de data;
- divergência entre status e preenchimento;
- avaliação postural incompleta;
- coleta ou painel ainda não confirmado.

Não há diagnóstico, hipótese clínica ou interpretação automática.

## Endpoints futuros necessários

Os caminhos são necessidades do front-end e ainda não representam contratos aprovados:

- `GET /api/patients/:patientId/attendances/current`
- `GET /api/patients/:patientId/attendances/:attendanceId/progress`
- `GET /api/patients/:patientId/attendances/:attendanceId/clinical-collection`
- `PUT /api/patients/:patientId/attendances/:attendanceId/clinical-collection/:step`
- `POST /api/patients/:patientId/attendances/:attendanceId/clinical-collection/complete`
- `GET /api/patients/:patientId/attendances/:attendanceId/clinical-panel`
- `POST /api/patients/:patientId/attendances/:attendanceId/clinical-panel/confirm`
- `POST /api/patients/:patientId/attendances/:attendanceId/clinical-panel/continue`

Autorização, idempotência, versionamento otimista e DTOs de erro deverão ser definidos no back-end.

## Limitações

- persistência apenas na sessão da aba;
- seleção de cenário e usuário são recursos do mock;
- sem autenticação real ou PostgreSQL;
- a partir da Sprint 012, a confirmação profissional do Painel libera o `Motor de Decisão Clínica` no fluxo oficial mockado;
- módulos de alimentação, treino, entregáveis e finalização são somente estados visuais sem rotas ou ações;
- sem IA, diagnóstico, imagens, PDFs ou geração de protocolos.
