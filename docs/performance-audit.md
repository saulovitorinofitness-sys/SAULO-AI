# Auditoria de Desempenho do SAULO AI

## 1. Objetivo

Medir o estado atual do front-end, identificar gargalos reais e aplicar apenas otimizações seguras para manter Clínica, Gestão, Performance e Biblioteca Científica escaláveis.

## 2. Estado inicial

Linha de base medida antes das otimizações desta sprint:

- tempo de build: 39,8s;
- compilação Next.js: 20,9s;
- TypeScript no build: 12,4s;
- total de chunks estáticos em `.next/static/chunks`: 33;
- tamanho total dos chunks estáticos: 1,88 MB.

## 3. Build e rotas

Build final medido após as otimizações:

- tempo de build: 31,5s;
- compilação Next.js: 12,6s;
- TypeScript no build: 12,6s;
- rotas dinâmicas principais mantidas:
  - `/dashboard`
  - `/gestao/inteligencia`
  - `/gestao/importacoes`
  - `/central-de-dados`
  - `/performance-endurance`
  - `/administracao/biblioteca-cientifica`
  - `/pacientes/[patientId]`
  - `/pacientes/[patientId]/anamnese`
  - `/pacientes/[patientId]/antropometria`
  - `/pacientes/[patientId]/exames`
  - `/pacientes/[patientId]/estrategia-nutricional`
  - `/pacientes/[patientId]/plano-alimentar`
  - `/pacientes/[patientId]/atendimentos/[attendanceId]/coleta`
  - `/pacientes/[patientId]/atendimentos/[attendanceId]/painel-clinico`
  - `/pacientes/[patientId]/atendimentos/[attendanceId]/decisao-clinica`

## 4. Componentes pesados

Os pontos com maior custo de carregamento foram isolados por rota:

- painéis executivos;
- importador de planilhas;
- Central de Dados;
- Biblioteca Científica;
- Performance Endurance;
- Prontuário Mestre;
- módulos clínicos de anamnese, antropometria, exames, estratégia e plano alimentar.

Componentes carregados sob demanda:

- `DashboardWorkspace`
- `ExecutiveDashboard`
- `ImportWorkspace`
- `SharedDataWorkspace`
- `PerformanceEnduranceWorkspace`
- `ScientificLibraryWorkspace`
- `PatientHub`
- `ClinicalAnamnesis`
- `AnthropometryPerimetryModule`
- `LaboratoryExams`
- `NutritionStrategyWorkspace`
- `MealPlanWorkspace`

## 5. Dependências

`package.json` foi inspecionado e não apresentou remoções seguras imediatas. As dependências continuam justificadas por uso atual:

- `next`
- `react`
- `react-dom`
- `@prisma/client`
- `@prisma/adapter-pg`
- `pg`
- `dotenv`
- `zod`
- `@e965/xlsx`

Nenhuma atualização de versão foi aplicada nesta sprint.

## 6. Dados mockados

Os mocks estão organizados por domínio e não foram unificados em um arquivo gigante único.

Domínios principais verificados:

- clínica;
- gestão;
- performance;
- biblioteca científica;
- importações;
- usuários e permissões.

## 7. Listas e tabelas

As rotas com maior risco de renderização extensa são:

- pacientes;
- anamnese;
- exames;
- Central de Dados;
- Biblioteca Científica;
- importações;
- histórico e timeline de módulos clínicos.

Medidas aplicadas:

- carregamento sob demanda em workspaces grandes;
- preservação de paginação/busca local já existentes;
- manutenção de estados vazios e loading.

## 8. Imagens e arquivos

Não houve introdução de novos arquivos pesados no bundle.

Imagens e assets continuam centralizados em `public` e na configuração de branding existente.

## 9. Importador de planilhas

O importador foi mantido na rota administrativa própria e o workspace foi carregado sob demanda.

Isso evita trazer a lógica de planilhas para outras áreas.

## 10. Clínica

O Prontuário Mestre permaneceu centralizado.

Foram isolados por rota:

- anamnese;
- antropometria/perimetria;
- exames;
- estratégia nutricional;
- plano alimentar.

## 11. Gestão

As rotas de Gestão permanecem separadas do prontuário e com carregamento sob demanda:

- Painel do CEO;
- Central de Inteligência;
- Central de Dados;
- Importações.

## 12. Performance

A área Performance segue isolada da Clínica e da Gestão.

O workspace principal foi carregado sob demanda na rota dedicada.

## 13. Biblioteca Científica

A Biblioteca Científica permanece fora do prontuário e sem carregamento global.

O workspace da biblioteca foi isolado em rota própria com importação dinâmica.

## 14. Otimizações realizadas

- split de bundle em rotas grandes com `next/dynamic`;
- remoção de carregamento eager de workspaces pesados;
- manutenção da lógica funcional e das permissões;
- preservação dos fluxos clínicos, empresariais e esportivos.

## 15. Itens não alterados e justificativas

- Prisma: não alterado.
- Migrations: não executadas.
- IA: não implementada.
- Regras clínicas: preservadas.
- Permissões: preservadas.
- Design System: não reescrito.

## 16. Linha de base de desempenho

Linha de base atual registrada:

- build total: 31,5s após otimização;
- chunks estáticos: 33;
- tamanho total de chunks estáticos: 1,88 MB;
- maiores chunks estáticos atuais:
  - 491,3 KB
  - 222,2 KB
  - 146,8 KB
  - 110 KB

## 17. Orçamento de desempenho

Regras iniciais para próximas sprints:

- não importar módulos inteiros em layouts globais;
- não carregar bibliotecas de planilhas fora do importador;
- não carregar componentes de Performance dentro da Clínica;
- não carregar Gestão dentro do Prontuário;
- não renderizar listas completas sem limite inicial;
- medir antes de otimizar;
- validar build após expansão relevante.

## 18. Regras para futuras sprints

- manter áreas Clínica, Gestão, Performance e Biblioteca Científica separadas;
- carregar workspaces pesados apenas na rota necessária;
- evitar arquivos de mocks gigantes centralizados;
- evitar imports de comodidade que tragam todo o domínio para o bundle;
- preservar acessibilidade ao aplicar splits.

## 19. Riscos futuros

- crescimento contínuo de mocks e históricos pode aumentar o tempo de build;
- ampliação de tabelas e timelines pode exigir paginação/virtualização em rota específica;
- novos módulos executivos podem concentrar lógica demais em um único workspace.

## 20. Próxima auditoria recomendada

Recomenda-se nova auditoria após a próxima expansão grande de:

- Prontuário Mestre;
- Biblioteca Científica;
- Central de Inteligência;
- Importações;
- Performance Endurance.
