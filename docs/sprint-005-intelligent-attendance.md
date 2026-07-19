# Sprint 005 — Atendimento Inteligente

## Fluxo operacional

`StartIntelligentAttendanceUseCase` executa a preparação na seguinte ordem:

1. reutiliza um atendimento existente quando a chave idempotente já foi processada;
2. obtém automaticamente o profissional do contexto autenticado;
3. valida a autorização para o tipo de consulta;
4. confirma a recepção pelo cadastro canônico do paciente;
5. carrega o único Prontuário Mestre;
6. verifica pendências pela continuidade;
7. prepara o resumo por referências às entradas existentes;
8. registra o tipo de consulta;
9. inicia o atendimento e persiste a linha do tempo.

## Tipos de consulta

- `INITIAL`
- `FOLLOW_UP`
- `PHYSICAL_ASSESSMENT`
- `POSTURAL_ASSESSMENT`
- `TRAINING`
- `NUTRITION`

## Persistência

- `Attendance` possui tipo, etapa atual, profissional, timestamps automáticos e `idempotencyKey` único.
- `AttendanceTimelineEvent` é ordenado por sequência única dentro do atendimento.
- `AttendancePendingCheck` referencia a versão da continuidade consultada.
- `AttendancePendingCheckItem` referencia as etapas pendentes originais.
- `AttendanceClinicalSummary` referencia a versão do Prontuário Mestre.
- `AttendanceClinicalSummaryItem` referencia as entradas originais do prontuário.

O método `createIntelligentAttendance` do repositório representa a gravação transacional do atendimento, verificação, resumo e linha do tempo. Assim, os registros ficam disponíveis na mesma fonte PostgreSQL aos usuários autorizados imediatamente após o commit.

## Registro durante a consulta

`RecordAttendanceActivityUseCase` acrescenta eventos cronológicos com profissional, módulo, horário e referência ao registro original. Valores clínicos não são copiados para a linha do tempo.

Não existem cálculos, interpretação clínica, inferência do tipo de consulta ou inteligência artificial.
