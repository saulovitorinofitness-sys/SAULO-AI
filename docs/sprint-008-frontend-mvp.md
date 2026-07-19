# Sprint 008 — Front-end MVP

## Fronteira de integração

A inspeção do projeto encontrou entidades, contratos de repositório, serviços e casos de uso de domínio. Não existem controllers, DTOs HTTP, Route Handlers ou endpoints publicados para o navegador. Por isso, esta Sprint usa `MvpFrontendGateway` como porta de integração e `mockMvpGateway` como adaptador temporário. A faixa fixa no layout identifica o ambiente demonstrativo e todas as confirmações informam que não há persistência.

Nenhum endpoint é efetivamente chamado nesta Sprint.

## Endpoints ausentes

- `GET /api/auth/session`: usuário conectado e snapshot efetivo de permissões.
- `GET /api/patients?query=`: pesquisa por nome, CPF, telefone e código.
- `POST /api/patients`: cadastro transacional do paciente e Prontuário Mestre.
- `GET /api/patients/:patientId/master-record/summary`: resumo permitido do prontuário e continuidade.
- `GET /api/patients/:patientId/attendance/continuity`: atendimento aberto ou mais recente e somente etapas pendentes.
- `POST /api/attendances/:attendanceId/activities`: registro auditável de nova atividade.

Esses caminhos representam necessidades do front-end, não contratos aprovados. Método, URL, autenticação, DTO, erros e concorrência deverão ser definidos no back-end antes de substituir o mock.

## Mocks temporários

- sessão demonstrativa de Saulo Xavier Vitorino com snapshot de acesso total;
- um paciente explicitamente denominado “Paciente de demonstração”, sem conteúdo clínico;
- resumo estrutural do Prontuário Mestre, sem detalhes clínicos;
- atendimento em andamento, etapas de continuidade e linha do tempo administrativa;
- respostas sem persistência para cadastro de paciente e nova atividade.

O adaptador é selecionado em `src/features/mvp/service.ts`, deixando a troca futura isolada.

## Rotas

- `/pacientes`
- `/pacientes/novo`
- `/pacientes/[patientId]`
- `/pacientes/[patientId]/continuar`
- `/atendimentos`
- `/sair`

## Permissões

A função `canAccess` recebe o snapshot do back-end, considera `PermissionGrant` e as restrições dos módulos `MEAL_PLAN` e `NUTRITION_EVOLUTION`. O bloqueio visual não substitui autorização do futuro endpoint.
