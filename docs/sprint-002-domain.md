# Sprint 002 — Estrutura do domínio

## Escopo entregue

Foram criados contratos TypeScript e modelos Prisma para autenticação, usuários, perfis, permissões, pacientes, prontuário mestre, agenda, atendimento, avaliações, planos, relatórios e entregáveis.

Não foram criados casos de uso, controladores, rotas, telas, cálculos clínicos, recomendações ou integrações de IA.

## Acesso inicial

| Usuário | Papel | Módulos gerais | Módulos de Nutrição |
| --- | --- | --- | --- |
| Saulo Xavier Vitorino | `SYSTEM_OWNER` | Acesso total | Acesso total |
| Maria de Lourdes Gomes | `SHARED_PROFESSIONAL` | Acesso total | Sem acesso |

`MEAL_PLAN` e `NUTRITION_EVOLUTION` estão marcados como `nutritionRestricted`. O seed também registra negações explícitas de leitura, criação, alteração, exclusão, exportação e administração desses módulos para Maria. Novos módulos exclusivos de nutricionistas devem ser cadastrados com a mesma marca.

As contas são criadas sem e-mail, senha ou identidade externa, pois esses dados não foram fornecidos. O módulo de autenticação está preparado para vincular credenciais ou provedores OIDC futuramente.

## Compartilhamento de dados

- O cadastro do paciente existe somente em `Patient`.
- Existe no máximo um `MasterRecord` por paciente.
- Registros dos módulos apontam para o mesmo prontuário e guardam autoria.
- Avaliações e planos não repetem dados cadastrais do paciente.
- Permissões restringem acesso ao módulo, não criam cópias privadas dos dados.

## Inicialização

Depois de configurar `DATABASE_URL` e aplicar a primeira migração, execute `npm run db:seed`. O seed é idempotente e pode ser repetido com segurança.
