# Dashboard Executivo do SAULO AI

## Objetivo

O Dashboard Executivo consolida, em uma única visão administrativa, indicadores demonstrativos da Clínica SV e da Academia Saulo Fitness. Ele não integra banco, sistemas financeiros, agenda real ou redes sociais.

## Rota e acesso

- Rota: `/dashboard`.
- Acesso exclusivo: Saulo Xavier Vitorino.
- Maria de Lourdes Gomes não recebe o item na navegação e obtém um estado de acesso negado ao tentar abrir a URL diretamente.
- A autorização é resolvida pela mesma sessão mockada usada pelo restante da aplicação.

## Fonte dos dados

Os contratos estão em `src/features/executive-dashboard/contracts.ts`, os dados em `mock-data.ts` e a autorização/consulta em `service.ts`. Essa separação permite substituir o adaptador mockado futuramente sem reescrever a interface.

## Áreas

1. Cabeçalho executivo com período, semanas e ações.
2. Nove KPIs principais.
3. Alertas operacionais.
4. Indicadores da clínica.
5. Indicadores da academia.
6. Financeiro com gráfico semanal comparativo.
7. Marketing.
8. Tarefas locais.
9. Agenda semanal.
10. Drawer de reunião semanal.

## Componentes

Os componentes ficam em `src/components/executive-dashboard`. A tela reutiliza `Button`, `Card`, `Badge`, `StatusBadge`, `Checkbox`, `FormField`, `Textarea`, `SectionHeader`, `PageState` e `MockNotice` do Design System.

## Interações demonstrativas

- Atualizar altera somente o horário visual da última atualização.
- Tarefas podem ser marcadas localmente.
- A reunião semanal pode ser preenchida e salva apenas durante a sessão visual.
- Nenhuma interação persiste após recarregar a página.

## Responsividade e acessibilidade

Os KPIs e painéis usam grids adaptativos. A agenda passa de sete colunas no desktop para cards empilhados no celular. O gráfico possui descrição textual para leitores de tela. O drawer usa `role="dialog"`, nome acessível, foco inicial e fechamento pela tecla Escape.

## Limitações do MVP

- Sem persistência real.
- Sem integração contábil, bancária, agenda, estoque ou redes sociais.
- Sem cálculo financeiro definitivo.
- Sem IA, previsões ou recomendações automáticas.
- Receita, despesas e lucro são valores exclusivamente demonstrativos.
