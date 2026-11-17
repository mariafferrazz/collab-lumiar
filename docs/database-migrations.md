# Migrations e PostgreSQL isolado

Este documento descreve o runner próprio da COLLAB, os testes destrutivos em
PostgreSQL descartável e o procedimento futuro de backup. Nenhum comando desta
etapa acessou a Railway.

## Estado da Etapa 2.1.3

Em 17 de novembro de 2026, consultas exclusivamente de leitura confirmaram que
o serviço PostgreSQL do projeto `collab`, ambiente `development`, está online em
PostgreSQL 18.6 (`server_version_num=180006`). O ledger
`collab_schema_migrations` ainda não existe. O ambiente `production` não foi
consultado e nenhuma migration, DDL ou DML foi executada na Railway.

Como a baseline anterior era PostgreSQL 17, o Compose descartável agora usa
`postgres:18-alpine` por padrão. `COLLAB_TEST_POSTGRES_IMAGE` continua podendo
fixar uma versão 18 mais específica sem alterar a migration. A imagem de
restauração também usa a mesma versão principal. Nas imagens oficiais 18+, o
`tmpfs` é montado em `/var/lib/postgresql`, pois os dados passaram a usar uma
subpasta específica da versão principal. O teste de exclusão por FK `RESTRICT`
também espera o SQLSTATE específico `23001` (`restrict_violation`); violações de
FK comuns continuam usando `23503` (`foreign_key_violation`).

## Isolamento do teste

Execute somente:

```bash
npm run test:integration:db
```

O orquestrador:

1. confirma Docker e Docker Compose;
2. gera senha aleatória somente em memória;
3. seleciona uma porta efêmera livre no Windows e a solicita ao Docker em
   `127.0.0.1`;
4. inicia PostgreSQL com dados em `tmpfs` e healthcheck;
5. consulta `docker compose port` e usa somente o mapeamento efetivamente
   devolvido, sem presumir que a porta solicitada foi aplicada ou reutilizar a
   porta de uma execução anterior;
6. aguarda separadamente a conexão TCP do Windows e uma consulta SQL real, com
   tentativas limitadas e intervalos progressivos;
7. marca o banco como `COLLAB_ISOLATED_TEST_DATABASE` e executa a suíte;
8. remove contêiner, rede e armazenamento temporários mesmo após falha.

O endpoint não é publicado em interfaces externas. A configuração segue a
orientação do Docker de vincular portas locais a `127.0.0.1`; o `tmpfs` mantém
os dados temporários na memória do contêiner, sujeito às características de
swap do host. Consulte [publicação de portas do
Docker](https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/)
e [tmpfs](https://docs.docker.com/engine/storage/tmpfs/).

No Windows, `docker compose --wait` comprova somente o healthcheck executado
dentro do ambiente Linux. Docker Desktop com backend WSL 2 ainda precisa
publicar essa porta por seu encaminhamento para o host. O orquestrador registra
separadamente: saúde interna, porta descoberta, prontidão TCP no Windows e
prontidão SQL. Senhas e URLs completas nunca são exibidas.

A rede Compose não usa `internal: true`: nessa combinação Docker Desktop/WSL 2,
essa opção manteve o healthcheck interno saudável, mas suprimiu o binding da
porta no Windows. O isolamento externo é garantido pelo binding explícito em
`127.0.0.1`, que não publica o PostgreSQL nas demais interfaces da máquina.

### Diagnóstico da recusa de conexão

O erro inicial `ECONNREFUSED` combinava três problemas independentes:

1. `pg_isready` confirmava somente o PostgreSQL dentro do contêiner;
2. a rede `internal: true` resultava em `"5432/tcp":[]`, sem binding para o
   Windows, embora o contêiner aparecesse como `Healthy`;
3. o processo Node montava a URL antes de consultar o mapeamento real e iniciava
   os testes sem aguardar TCP e SQL.

A correção vincula a porta somente a `127.0.0.1`, solicita uma porta efêmera
nova, lê a fonte de verdade com `docker compose port` e executa readiness em duas
camadas. No teste final da Etapa 2.1.3, a porta publicada aceitou TCP e o
PostgreSQL 18.7
respondeu SQL já na primeira tentativa. Nenhuma porta de execução anterior foi
reutilizada.

## Proteções do runner

O comando `npm run db:migrate:test` continua aceitando exclusivamente:

- `DATABASE_ENVIRONMENT=test`;
- `MIGRATION_TARGET=isolated-postgres`;
- `COLLAB_TEST_DATABASE_URL` com host de loopback, porta explícita, senha
  temporária e nomes de banco/usuário iniciados por `collab_test_`;
- banco real com o comentário marcador `COLLAB_ISOLATED_TEST_DATABASE`;
- endereço observado pelo servidor privado ou de loopback;
- PostgreSQL 14 ou superior.

`DATABASE_URL` não é lida por esse comando. Portanto, uma URL da Railway
presente em `.env.local` não é candidata à execução acidental.

Dentro de uma única transação e conexão, o runner:

1. verifica a identidade real do servidor;
2. adquire `pg_advisory_xact_lock` com chaves estáveis;
3. cria o ledger independente `collab_schema_migrations`;
4. compara o ledger com o manifesto e os checksums SHA-256;
5. executa migrations ainda não registradas;
6. registra cada migration somente depois de seu SQL concluir;
7. confirma a transação inteira ou reverte DDL e ledger em conjunto.

Locks consultivos transacionais são liberados automaticamente ao fim da
transação e aguardam quando a mesma chave já está bloqueada, conforme a
[documentação do
PostgreSQL](https://www.postgresql.org/docs/current/functions-admin.html).

O verificador recusa comandos incompatíveis com o fluxo transacional, incluindo
controle manual de transação, `CREATE INDEX CONCURRENTLY`, `REINDEX
CONCURRENTLY`, `VACUUM`, operações de database/tablespace e `ALTER SYSTEM`.
`CREATE INDEX CONCURRENTLY`, por exemplo, não pode ser executado dentro de uma
transação segundo a [documentação oficial](https://www.postgresql.org/docs/current/sql-createindex.html).

O ledger não é o histórico interno do Drizzle Kit. Não use `drizzle-kit push`,
`drizzle-kit migrate` ou outro histórico em paralelo.

## Cobertura dos testes PostgreSQL

`tests/integration/postgres-migrations.test.ts` valida:

- criação das oito tabelas de domínio e do ledger;
- funções PL/pgSQL, triggers, índices, PKs, FKs, checks e tipos;
- primeira execução e segunda execução idempotente;
- checksum divergente e manifesto inválido;
- rollback de DDL e ledger após falha proposital;
- dois runners concorrentes sob o mesmo advisory lock;
- interrupção forçada da conexão;
- categorias válidas, ciclos diretos/indiretos e corrida concorrente;
- publicação adiada até o commit, estados e exclusões protegidas;
- SKU, estoque, variação padrão e disputa concorrente;
- imagem principal, ordem e associação;
- pesos, dimensões, fragilidade, volumes separados e perfil efetivo;
- preenchimento de `created_at` e trigger de `updated_at`.

No `npm test` comum, a suíte destrutiva aparece como `skipped` porque não recebe
a URL temporária. `npm run test:integration:db` provisiona o banco e executa os
11 cenários; todos foram aprovados nesta etapa.

## Backup lógico de development — preparado, não executado

O backup remoto exige nova autorização. Use binários PostgreSQL 18, compatíveis
com o servidor 18.6, e mantenha todos os arquivos em um diretório local como
`%LOCALAPPDATA%\COLLAB\migration-evidence`, fora do Git e fora do OneDrive.
Não use um diretório filho do projeto. A senha deve ficar em `PGPASSFILE` com
permissões restritas ou em variáveis de sessão; nunca na linha de comando.

1. Confirme novamente, com parâmetros explícitos, o projeto e o ambiente:

   ```powershell
   railway status --project collab --environment development
   railway connect Postgres --environment development --tunnel-only
   ```

   Interrompa se o resumo não indicar exatamente `collab` e `development`.
   Mantenha o terminal do túnel aberto e configure um serviço libpq local
   `collab-development-backup` sem exibir a senha.

2. Crie o diretório externo e gere o dump customizado. O nome deve incluir data
   e hora para impedir sobrescrita acidental:

   ```powershell
   pg_dump --dbname="service=collab-development-backup" --format=custom --no-owner --no-acl --file=$backupPath
   ```

3. Confirme tamanho maior que zero, assinatura `PGDMP`, inventário legível e
   checksum SHA-256. O inventário também permanece fora do OneDrive:

   ```powershell
   pg_restore --list $backupPath | Out-File -Encoding utf8 $inventoryPath
   Get-FileHash -Algorithm SHA256 $backupPath
   Get-FileHash -Algorithm SHA256 $inventoryPath
   ```

4. Gere, por consultas de catálogo somente leitura, um inventário canônico dos
   objetos do schema `public` na origem. Registre apenas quantidade e SHA-256 do
   arquivo; não inclua dados de clientes ou credenciais.

O formato custom é reconhecido pelo `pg_restore` e o runner futuro confere o
arquivo real, tamanho, assinatura e SHA-256 antes de conectar. O `.gitignore`
bloqueia extensões de dump como defesa adicional, mas não substitui o diretório
externo.

## Restauração descartável — preparada, não executada

`compose.postgres-restore.yml` cria um PostgreSQL 18 novo em `tmpfs`, sem porta
publicada, e monta o diretório de backup como somente leitura. Ele nunca deve
receber `DATABASE_URL` da Railway.

```powershell
$env:COLLAB_RESTORE_BACKUP_DIRECTORY = Split-Path -Parent $backupPath
$env:COLLAB_RESTORE_DB_PASSWORD = [Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
docker compose -f compose.postgres-restore.yml -p collab-restore-validation up --detach --wait
docker compose -f compose.postgres-restore.yml -p collab-restore-validation exec -T postgres-restore pg_restore --list "/backup/$backupFileName"
docker compose -f compose.postgres-restore.yml -p collab-restore-validation exec -T postgres-restore pg_restore --dbname=collab_restore_validation --username=collab_restore_runner --exit-on-error --single-transaction --no-owner --no-acl "/backup/$backupFileName"
```

Depois da restauração, gere o mesmo inventário canônico no banco descartável e
exija quantidade e SHA-256 idênticos aos da origem. Verifique também tabelas,
constraints, índices, funções e triggers. Somente então registre a evidência
JSON externa com estes campos:

- projeto e ambiente exatamente `collab` / `development`;
- fingerprint SHA-256 da instância e versão principal 18;
- caminho absoluto, tamanho e SHA-256 do dump;
- SHA-256 do inventário produzido por `pg_restore --list`;
- quantidades e SHA-256 dos inventários de origem e restauração;
- SHA-256 do manifesto de migrations;
- horários de criação, verificação e restauração.

Finalize sempre removendo o ambiente descartável e as variáveis temporárias:

```powershell
docker compose -f compose.postgres-restore.yml -p collab-restore-validation down --volumes --remove-orphans
Remove-Item Env:COLLAB_RESTORE_DB_PASSWORD
```

## Preflight e aplicação futura em Railway development

O modo novo é separado do runner descartável. Primeiro, com o túnel já aberto,
configure localmente as variáveis vazias previstas em `.env.example` e execute:

```bash
npm run db:migrations:plan:development
```

Esse comando abre uma transação `READ ONLY`, confirma PostgreSQL 18 e calcula um
fingerprint SHA-256 canônico da instância, banco, usuário e versão. Em seguida,
lê o ledger se ele existir e apresenta pendências. Não cria objetos. A
simulação totalmente offline é `npm run db:migrations:plan`.

`npm run db:migrate:development` existe para uma etapa futura autorizada, mas
recusa a execução até todas as condições abaixo coincidirem:

1. projeto `collab`, ambiente `development` e alvo `railway-development`;
2. URL dedicada `COLLAB_DEVELOPMENT_DATABASE_URL` em loopback, com porta
   explícita; `DATABASE_URL` não é lida;
3. PostgreSQL principal 18 e fingerprint real igual ao preflight aprovado;
4. evidência externa de backup com no máximo 24 horas, SHA-256 correto,
   inventário e restauração correspondentes;
5. manifesto versionado íntegro e autorização exata
   `APPLY_COLLAB_DEVELOPMENT:<sha256-do-manifesto>`;
6. advisory lock transacional, ledger sem divergência e proteção contra
   checksums modificados ou execução duplicada;
7. DDL e inserção no ledger dentro da mesma transação, com rollback integral em
   qualquer erro.

O ambiente `production`, URLs remotas diretas, backup dentro do projeto ou do
OneDrive, evidência vencida e autorização genérica são rejeitados antes da
aplicação. Este comando não foi executado nesta etapa.

Após uma futura aplicação autorizada, confira o ledger e os objetos com o
preflight somente leitura. Em falha antes do commit, o PostgreSQL reverte DDL e
ledger. Se houver falha operacional depois do commit, interrompa novas escritas
e restaure o backup validado em uma instância nova; não sobrescreva o banco
existente sem uma decisão de incidente aprovada.

Referências oficiais: [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) e
[backup por dump SQL](https://www.postgresql.org/docs/18/backup-dump.html).

Production permanece bloqueado. A estratégia UUID do Better Auth também
permanece pendente: a Etapa 2.2 deverá gerar o schema oficial antes de adicionar
qualquer FK a `customer_addresses.user_id`.
