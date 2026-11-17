# Migrations do catálogo COLLAB

Esta pasta contém SQL versionado para revisão antes de qualquer alteração no
PostgreSQL. Nenhum arquivo daqui foi executado nesta etapa.

## Estado da Etapa 2.1.1

- `0000_collab_catalog.sql` define as oito tabelas do domínio, índices,
  constraints e triggers PL/pgSQL revisados;
- `manifest.json` fixa ID, ordem e SHA-256 do arquivo SQL;
- não existem dados pessoais, seeds, URLs ou credenciais;
- não existe journal/snapshot do Drizzle Kit nem migration registrada no banco;
- `npm run db:migrations:check` valida ambiente local e checksum sem abrir
  conexão.
- o runner próprio usa o ledger `collab_schema_migrations`, separado do Drizzle
  Kit, e aceita somente um PostgreSQL descartável marcado.

O Drizzle Kit estável avaliado (`0.31.11`) não foi instalado porque sua árvore
produziu alertas moderados no `npm audit`. O candidato avaliado (`1.0.0-rc.5`)
exige `drizzle-orm >= 1.0.0-rc.5`, incompatível com a versão estável do projeto.
Não misture este SQL manual revisado com `drizzle-kit push` ou geração automática.

## Regras para arquivos futuros

1. Nunca altere o conteúdo de uma migration depois de aplicada.
2. Use ID crescente, nome único e registre o SHA-256 em `manifest.json`.
3. Não inclua DML de produção, dados pessoais, credenciais ou endpoints.
4. Revise dependências, locks, reversibilidade e compatibilidade antes de obter
   autorização.
5. Primeiro teste em PostgreSQL descartável restaurado de backup; depois use
   transação, advisory lock e ledger de checksums exclusivamente em
   `development`.
6. A adoção futura do Drizzle Kit exige uma decisão explícita de baseline; não
   crie dois históricos concorrentes.

O procedimento completo de backup, teste, aplicação e rollback futuro está no
`README.md` e em `docs/database-migrations.md`. A suíte real foi aprovada em
PostgreSQL 17.12 isolado, com 11 cenários de migration, integridade,
concorrência e rollback. Production permanece fora de escopo.
