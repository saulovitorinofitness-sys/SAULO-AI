# Motor de Prescrição Nutricional — MVP

## Objetivo

O Motor de Prescrição Nutricional é um editor assistido integrado ao Plano Alimentar. Ele organiza dados já existentes do paciente e recursos da Biblioteca Científica para que o nutricionista monte refeições manualmente. Não gera dieta, quantidades, substituições, suplementos ou decisões automaticamente.

## Rota e integração

- Rota existente: `/pacientes/[patientId]/plano-alimentar`.
- Não existe item independente no menu.
- O Motor é renderizado dentro do workspace do Plano Alimentar, preservando o Prontuário Mestre e a navegação clínica.

## Permissões

- Saulo Xavier Vitorino: acesso total.
- Maria de Lourdes Gomes: Plano Alimentar e Motor não são renderizados.
- O acesso direto continua protegido por `MEAL_PLAN/READ`, `hub.showNutrition` e pelo serviço da Biblioteca Científica.

## Fontes reutilizadas

### Prontuário Mestre e Anamnese

O painel do paciente reutiliza objetivo, diagnósticos registrados, restrições, alergias, preferências, suplementação, horários e rotina. Quando um campo não existe, exibe “Dado ainda não registrado no Prontuário Mestre.”, sem criar novo cadastro.

### Biblioteca Científica

Alimentos, receitas e suplementos são recebidos exclusivamente por `scientificLibraryService`. Cada entrada da montagem guarda `scientificLibraryItemId`; nenhum catálogo nutricional foi criado dentro do Motor.

A Biblioteca Científica foi evoluída para expor receitas já registradas na Central de Dados. Alimentos agora possuem sinônimos na fonte compartilhada, permitindo busca sem duplicação.

## Painéis

1. **Paciente:** contexto já registrado.
2. **Biblioteca nutricional:** busca instantânea, filtros, favoritos, alimentos, receitas e suplementos.
3. **Montagem da refeição:** quantidade manual, medida caseira, observação, ordem, agrupamento, duplicação, exclusão e substituições.
4. **Resumo:** refeições, itens, substituições, observações, última edição e responsável.

## Busca

A busca local considera nome, sinônimo, grupo alimentar, tags, categoria e origem. Os filtros por grupo, base, categoria, tag e favorito podem ser combinados. Nenhuma consulta externa ou IA é utilizada.

## Substituições

Uma substituição referencia outro alimento da Biblioteca Científica e registra grupo, observação e prioridade. O sistema não afirma equivalência nutricional: cada vínculo recebe o aviso de que necessita revisão profissional.

## Receitas e suplementos

Receitas já cadastradas podem ser adicionadas à refeição como referência da Biblioteca. Suplementos também podem ser adicionados, mas quantidade e medida permanecem vazias até decisão manual do nutricionista. Não existe sugestão ou dose automática.

## Estado e persistência

Montagem, filtros e favoritos usam estado React local. Todos os dados são perdidos ao recarregar. O Plano Alimentar existente foi preservado e continua demonstrativo.

## Componentes

- `NutritionPrescriptionEngine`.
- `NutritionPatientPanel`.
- `NutritionLibraryPanel`.
- `MealAssemblyPanel`.
- `PrescriptionSummaryPanel`.

Todos reutilizam o Design System existente.

## Limitações

- Sem banco ou persistência real.
- Sem IA.
- Sem cálculo de calorias ou macronutrientes.
- Sem geração automática de plano.
- Sem equivalência nutricional calculada.
- Sem sugestão de alimento, suplemento ou dose.
- Sem validação clínica definitiva.
- A decisão final é exclusivamente do nutricionista.
