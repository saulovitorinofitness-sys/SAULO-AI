# Módulos de domínio

Cada capacidade do SAULO AI ocupa uma pasta própria e publica somente tipos e contratos pelo arquivo `index.ts`.

## Regras de dependência

1. Módulos não importam detalhes internos de outros módulos.
2. Identificadores, paginação e valores JSON compartilhados vêm de `shared`.
3. O Prisma é um adaptador de persistência e não faz parte dos contratos de domínio.
4. Integrações entre módulos usam identificadores e contratos públicos.
5. Regras clínicas, fórmulas e recomendações não pertencem a esta estrutura.

## Módulos disponíveis

- `authentication`
- `users`
- `profiles`
- `permissions`
- `patients`
- `master-record`
- `scheduling`
- `attendance`
- `bioimpedance`
- `perimetry`
- `physical-assessment`
- `postural-assessment`
- `meal-plan`
- `workout-plan`
- `reports`
- `deliverables`
- `audit`
- `clinical-reasoning`
- `clinical-evolution`

`shared` contém apenas tipos técnicos comuns e não representa uma capacidade de negócio.
