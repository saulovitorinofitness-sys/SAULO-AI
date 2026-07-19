# SAULO AI

Sistema Integrado Clínica SV e Academia Saulo Fitness.

Fundacao tecnica do sistema web SAULO AI.

## Stack

- Next.js com App Router
- TypeScript em modo estrito
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Requisitos

- Node.js 20.19 ou superior
- npm 10 ou superior
- Uma instancia PostgreSQL acessivel

## Preparacao local

1. Instale as dependencias com `npm install`.
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
3. Gere o cliente com `npm run db:generate`.
4. Aplique as migrações com `npm run db:migrate` quando houver um PostgreSQL configurado.
5. Cadastre os módulos e acessos iniciais com `npm run db:seed`.
6. Valide a fundação com `npm run check`.

O projeto ainda não possui uma página. O servidor web receberá rotas apenas em uma sprint de aplicação ou interface.

## Estrutura

```text
prisma/schema/         Modelos Prisma separados por responsabilidade
prisma/seed.ts         Módulos, usuários e acessos iniciais
src/
  app/                 Entrada do Next.js App Router
  config/              Variaveis de ambiente validadas
  lib/database/        Adaptador compartilhado do Prisma
  modules/             Contratos de domínio isolados por capacidade
docs/architecture.md   Decisões e limites arquiteturais
```

Consulte `docs/architecture.md` e `docs/sprint-002-domain.md` antes de adicionar novos módulos.
