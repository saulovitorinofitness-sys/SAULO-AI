# Plano Alimentar Inteligente - MVP

> O Motor de Prescrição Nutricional foi integrado a esta mesma rota. Ele consome alimentos, receitas e suplementos exclusivamente da Biblioteca Científica e mantém a decisão final com o nutricionista. O acesso ao plano agora depende da Estratégia Nutricional estar registrada no fluxo atual.

## Estrutura

O módulo está integrado ao mesmo Prontuário Mestre pela rota `/pacientes/[patientId]/plano-alimentar`. Os contratos ficam em `src/features/meal-plan/contracts.ts`, os dados demonstrativos em `mock-data.ts` e a leitura substituível por endpoint em `service.ts`.

A interface possui quatro áreas:

1. Resumo nutricional com valores previamente registrados no mock.
2. Editor estrutural composto por cards de refeições.
3. Detalhamento da refeição selecionada.
4. Painel lateral com contagens estruturais, autoria, atualização e status.

Nenhum valor nutricional é calculado. Textos sobre calorias e macronutrientes são valores demonstrativos já registrados, não resultados produzidos pela aplicação.

## Fluxo

O acesso ocorre pelo card ou pela aba Plano Alimentar no Prontuário Mestre. A rota mantém `patientId` e `scenario`, utiliza `PatientNavigation` e preserva o cabeçalho, breadcrumb e contexto do paciente.

O Plano Alimentar fica bloqueado quando a Estratégia Nutricional ainda está em rascunho. Nesse caso, a tela mostra a orientação para abrir a estratégia primeiro.

As ações Editar, Visualizar, Duplicar e Excluir alteram apenas estado local. Recarregar a página restaura o mock original. A inclusão de uma nova refeição exibe somente feedback de simulação.

## Componentes utilizados

- `PatientNavigation`, que compõe `PatientHubHeader`, `PatientBreadcrumb` e `MasterRecordTabs`.
- `PageHeading`.
- `Button`, `ButtonLink`.
- `Card` e suas estruturas internas.
- `Badge` e `StatusBadge`.
- `SectionHeader` e `Divider`.
- `FormField`, `Input`, `Textarea` e `Select`.

Componentes do módulo:

- `MealPlanWorkspace`.
- `NutritionSummary`.
- `MealCard`.
- `MealEditor`.
- `MealPlanSidebar`.

## Permissões

Saulo Xavier Vitorino acessa o módulo pelo grant existente de `MEAL_PLAN/READ`. Maria de Lourdes Gomes mantém o bloqueio existente: card e aba não são renderizados; acesso direto retorna um estado de acesso não permitido sem expor dados nutricionais.

A camada visual não substitui a autorização do back-end futuro.

## Limitações

- Dados exclusivamente mockados.
- Sem PostgreSQL ou persistência real.
- Sem alteração de Prisma ou migrations.
- Sem IA.
- Sem geração automática de plano ou alimentos.
- Sem cálculos de calorias ou macronutrientes.
- Sem interpretação de exames.
- Sem prescrição automática.
- Sem validação clínica definitiva.
- Decisão e confirmação permanecem exclusivas do nutricionista habilitado.
