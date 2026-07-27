# Evolução da Avaliação Postural

## Fonte de verdade

Cada avaliação postural pertence a um `MasterRecordEntry`, vinculado ao
paciente pelo `MasterRecord` e ao atendimento por `attendanceId`. As
fotografias permanecem em `PosturalAssessmentRecord.observations`, separadas
pelas chaves `ANTERIOR`, `POSTERIOR`, `RIGHT_LATERAL` e `LEFT_LATERAL`.

Uma nova avaliação utiliza um novo `MasterRecordEntry`. Assim, salvar uma
reavaliação não substitui as fotografias ou os achados de atendimentos
anteriores.

## Linha evolutiva

A ordenação usa `assessedAt`. O primeiro registro válido é inicial, os
registros entre o primeiro e o mais recente são intermediários, e o registro
mais recente é o atual ou final. Uma linha com apenas um registro o identifica
simultaneamente como inicial e atual.

Cada item preserva:

- data e status do registro;
- atendimento e avaliação de origem;
- profissional, atualização e revisão;
- fotografias por vista;
- achados, graus, observações e relevância.

## Requisito permanente dos entregáveis

Os entregáveis futuros deverão organizar a evolução em:

- **Antes:** avaliação e fotografias iniciais, achados, graus e observações.
- **Durante:** reavaliações, mudanças observadas, manutenção, melhora ou
  piora, condutas aplicadas e observações de acompanhamento.
- **Depois:** avaliação mais recente ou final, fotografias finais, comparação
  com a avaliação inicial, evolução de cada achado, conclusão do avaliador e
  próximos passos.

A comparação deverá poder ser apresentada lado a lado, por vista, por data e
no formato antes × durante × depois. Esta definição não implementa relatório,
PDF ou comparação sincronizada nesta Sprint.
