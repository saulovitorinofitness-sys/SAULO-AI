# Estratégia Nutricional

## Objetivo

Estruturar a etapa intermediária entre o Motor de Decisão Clínica e o Plano Alimentar. A Estratégia Nutricional organiza o raciocínio profissional antes da montagem do plano e não gera dieta automaticamente.

## Fluxo

O acesso ocorre pelo Prontuário Mestre, no bloco de prescrições, pela rota `/pacientes/[patientId]/estrategia-nutricional`.

Quando a estratégia está registrada no mock atual, o Plano Alimentar fica liberado. Quando está em rascunho, o plano permanece bloqueado.

## Estrutura

O módulo foi organizado em oito blocos:

1. Objetivo principal.
2. Objetivos secundários.
3. Estratégia nutricional.
4. Distribuição das refeições.
5. Estratégias complementares.
6. Suplementação.
7. Observações clínicas.
8. Resumo.

O painel lateral consolida status, última atualização, responsável e referências da Biblioteca Científica.

## Integrações

- `Prontuário Mestre`, via `PatientNavigation` e configuração central de módulos.
- `Motor de Decisão Clínica`, para compor contexto e manter a sequência oficial do fluxo.
- `Biblioteca Científica`, para selecionar suplementos e referências estruturadas.
- `Plano Alimentar`, que depende da estratégia antes de ser aberto.

## Permissões

Somente Saulo Xavier Vitorino visualiza o módulo. Maria de Lourdes Gomes continua sem acesso às funcionalidades exclusivas da Nutrição.

## Limitações

- Sem IA.
- Sem cálculo clínico.
- Sem geração automática de dieta.
- Sem persistência em banco.
- Alterações são demonstrativas e ficam apenas na memória da página.
