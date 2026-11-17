# Instalação do schema PostgreSQL

## Banco novo

Use um banco PostgreSQL vazio, com uma credencial exclusiva que seja proprietária
desse banco, e execute:

```powershell
$env:DATABASE_URL = "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO"
npx prisma migrate deploy
```

A migração `20260719000000_initial_baseline` cria o schema original anterior ao
histórico incremental. Ela é condicional: em bancos que já tenham migrações
posteriores concluídas, registra a baseline sem recriar tabelas ou tipos.

## Extensão `pg_trgm`

A migração `20260803190000_safe_evonut_foods_measures` executa
`CREATE EXTENSION IF NOT EXISTS pg_trgm` antes de criar o índice trigram.
Normalmente o proprietário do banco consegue instalar essa extensão confiável.

Em serviços gerenciados que proíbam a criação de extensões pela credencial da
aplicação, um administrador deve executar, **no banco de destino**, antes do
deploy:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Depois disso, execute `npx prisma migrate deploy` com a credencial normal da
aplicação. Não use `prisma db push` para instalar ou atualizar ambientes.

## Conferência do destino

Antes de qualquer deploy, confirme host, porta, nome do banco e usuário com:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
```

Para ambientes de teste, use banco e credencial exclusivos e nunca reutilize a
URL do banco da clínica.
