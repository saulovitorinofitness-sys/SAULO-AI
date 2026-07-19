# Central de Inteligência Empresarial

## Objetivo

A Central de Inteligência organiza a reunião executiva semanal de Saulo Xavier Vitorino. Ela consolida dados demonstrativos da Clínica SV e da Academia Saulo Fitness sem produzir previsões, diagnósticos empresariais ou decisões automáticas.

## Rota e permissão

- Rota: `/gestao/inteligencia`.
- Área: Gestão, fora do Prontuário Mestre.
- Acesso exclusivo: Saulo Xavier Vitorino.
- Maria de Lourdes Gomes não recebe o item no menu e encontra um estado de acesso negado em acesso direto.

## Estrutura

1. Resumo executivo da semana, período, receitas, despesas, lucro, meta e percentual.
2. Indicadores separados de Clínica, Academia, Financeiro, Marketing e Comercial.
3. Gráfico financeiro semanal demonstrativo.
4. Alertas empresariais para conferência humana.
5. Quadro editável de problemas da semana.
6. Plano de ação local com responsável, prazo e status.
7. Metas editáveis para a próxima semana.
8. Drawer de reunião executiva em sete etapas.
9. Ata com decisões, pendências, responsáveis e observações.

## Dados e arquitetura

Os contratos ficam em `src/features/executive-intelligence/contracts.ts`, os dados mockados em `mock-data.ts` e a autorização/consulta em `service.ts`. A interface fica em `src/components/executive-intelligence`.

Os contratos genéricos `ExecutiveMetric` e `FinancialPeriod`, bem como o gráfico `RevenueChart`, são reutilizados do Dashboard Executivo. A Central mantém tipos próprios somente para problemas, ações, metas, alertas ampliados e reunião.

## Reunião executiva

O botão **Iniciar Reunião** abre um drawer com as etapas:

1. Resumo.
2. Indicadores.
3. Problemas.
4. Plano de ação.
5. Metas.
6. Próxima semana.
7. Ata.

O drawer possui navegação sequencial, seleção direta de etapa, foco inicial, fechamento por `Escape` e mensagens acessíveis. Todo preenchimento permanece apenas no estado local da página.

## Design System e responsividade

A interface reutiliza `Button`, `Card`, `SectionHeader`, `PageHeading`, `StatusBadge`, `Progress`, `Input`, `Select`, `Checkbox`, `Textarea` e o gráfico existente. Os grids passam para uma coluna em telas pequenas; listas, ações e o drawer não dependem de tabelas largas.

## Limitações do MVP

- Somente dados mockados.
- Sem banco e sem persistência após recarregar.
- Sem IA.
- Sem previsões ou recomendações automáticas.
- Sem integração contábil, bancária, CRM, redes sociais ou Next Fit.
- Indicadores e comparativos não representam dados reais.
- A decisão empresarial final permanece com Saulo Xavier Vitorino.
