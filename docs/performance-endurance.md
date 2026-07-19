# Performance Endurance SV

## Objetivo

Arquitetura visual inicial para acompanhamento integrado de Corrida de Rua, Ciclismo Speed, MTB, Duathlon e Triathlon nas dimensões Saúde, Performance, Nutrição e Recuperação.

## Rota e permissão

- Rota: `/performance-endurance`.
- Saulo Xavier Vitorino possui acesso total.
- Maria de Lourdes Gomes não recebe o item no menu e encontra acesso negado na URL direta.

## Estrutura

1. Dashboard do atleta.
2. Planejamento em macrociclo, mesociclo, microciclo, semana e sessão.
3. Treinos de corrida, Speed, MTB, musculação, recuperação e mobilidade.
4. Métricas esportivas demonstrativas.
5. Equipamentos.
6. Competições.
7. Nutrição Esportiva.
8. Recuperação.
9. Histórico integrado.
10. Placeholders para importações futuras.

## Arquitetura

Contratos e serviço ficam em `src/features/performance-endurance`. Dados demonstrativos permanecem em `mock-data.ts`. A apresentação está dividida em componentes em `src/components/performance-endurance`, sem misturar regras de treino, nutrição ou clínica.

## Dados compartilhados

Peso, bioimpedância, exames, avaliações e consultas aparecem como referências históricas ao registro de origem. Uma implementação real deverá manter o mesmo MasterRecord e não duplicar dados.

## Integrações futuras

Garmin, Apple Watch, Strava, Coros, Polar, FIT, TCX, GPX e CSV aparecem somente como “Em desenvolvimento”. Não há API, leitura de arquivo ou sincronização nesta Sprint.

## Limitações

Todos os dados são mockados. Não há persistência, IA, cálculos definitivos, prescrição automática, interpretação de carga, recomendação nutricional, upload ou integração externa.
