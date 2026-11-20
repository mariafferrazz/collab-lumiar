# Reconciliação do PostgreSQL local

## Estado

Em 19 de novembro de 2026, o guard da pré-visualização local recusou iniciar a
aplicação porque o ledger do volume persistente registra uma versão anterior da
migration `0002_collab_financial_pricing`. A recusa é correta e não deve ser
contornada.

O diagnóstico, o backup, a restauração e o ensaio em PostgreSQL descartável
foram concluídos. Em 20 de novembro de 2026, a proprietária autorizou o plano e
a reconciliação foi executada em um volume novo. O volume original continua
intacto e disponível para rollback; ele não foi sobrescrito, renomeado ou
apagado.

## Alvo confirmado

- banco: `collab_local_admin`;
- usuário técnico: `collab_local_admin`;
- marcador: `COLLAB_LOCAL_DEVELOPMENT_DATABASE`;
- PostgreSQL: 18.7;
- endpoint: `127.0.0.1:55432`;
- Compose: `collab-local-admin`;
- volume ativo: `collab-local-admin-reconciled-data`;
- volume original preservado: `collab-local-admin-data`;
- imagem: `postgres:18-alpine`;
- exposição externa: nenhuma, além do binding de loopback.

Nenhum comando Railway foi executado e nenhuma URL remota foi usada.

## Causa confirmada

O ledger havia sido criado com uma revisão anterior da `0002`. A migration
canônica atual possui:

```text
09a312fb31f814b342849b3b9187f584482a8cb43b81d536c28376d2408922af
```

No início do diagnóstico, a `0002` ainda não fazia parte do histórico Git
publicado, portanto a mudança não podia ser reconstruída por commits. A
comparação do catálogo PostgreSQL instalado com um banco novo criado pelas
migrations canônicas confirmou que a divergência era estrutural e
comportamental, não apenas um valor antigo no ledger.

Diferenças encontradas no banco persistente:

1. ausência da constraint
   `product_financial_costs_fixed_agreement`, que recalcula no banco o adicional
   fixo de 40%, a divisão 50/50 e o resíduo;
2. versão anterior de `collab_validate_pricing_scenario()`, sem todas as
   verificações canônicas de vigência, modalidade e correspondência do método de
   pagamento;
3. versão anterior de
   `collab_assert_product_financially_publishable(uuid)`, que não bloqueia toda
   variação ativa com preço específico sem custo e cenário validados.

As cinco tabelas, cinco enums, índices, FKs, demais constraints, seis funções e
triggers financeiros estão presentes. As três diferenças acima são suficientes
para impedir que o ledger seja simplesmente atualizado.

## Inventário dos dados

Foram registradas somente contagens, sem e-mail, senha, hash, token ou cookie:

| Grupo                                   | Contagem |
| --------------------------------------- | -------: |
| usuários                                |        1 |
| contas Better Auth                      |        1 |
| sessões                                 |        1 |
| verificações                            |        0 |
| artistas, categorias e produtos         |        0 |
| variações, imagens e logística          |        0 |
| endereços                               |        0 |
| registros das cinco tabelas financeiras |        0 |

Existe uma única conta `ADMIN`, verificada, desbloqueada e com credencial
Better Auth. O UUID e a credencial foram comparados sem exibir seus valores.

## Backup validado

Foi criado um backup custom PostgreSQL (`PGDMP`) com `pg_dump` 18.7. Assinatura,
tamanho, inventário e SHA-256 foram validados antes da recuperação. O arquivo e
as evidências permanecem em armazenamento local privado, fora do projeto e do
OneDrive; nomes, caminhos e hashes operacionais não são versionados.

O dump contém autenticação local e deve ser tratado como confidencial. Ele não
pode ser anexado ao Git, enviado a serviços externos ou copiado para uma pasta
sincronizada.

## Restauração comprovada

O dump foi restaurado, com `--exit-on-error` e transação única, em PostgreSQL
18.7 descartável. A instância não utilizou o volume original e foi removida ao
final.

Resultados:

- restauração concluída sem erro;
- três entradas do ledger preservadas;
- conta `ADMIN`, credencial e sessão preservadas;
- nenhuma FK inválida;
- 18 tabelas restauradas;
- inventário restaurado com o mesmo SHA-256 da origem;
- contagens idênticas.

## Ensaio da estratégia de recuperação

Um segundo PostgreSQL 18.7 descartável recebeu:

1. as migrations canônicas `0000`, `0001` e `0002`, pelo runner existente;
2. um dump somente de dados, excluindo deliberadamente
   `collab_schema_migrations`;
3. os registros de autenticação com seus IDs e relacionamentos originais.

Não houve transformação de dados porque as tabelas de catálogo e financeiro
estavam vazias. O warning do `pg_dump` sobre a FK autorreferente de categorias
não afetou esta base concreta; uma execução futura com categorias deverá usar
uma carga ordenada e validada, nunca ignorar constraints indiscriminadamente.

O ensaio confirmou:

- primeira execução: três migrations canônicas aplicadas;
- segunda execução: três migrations reconhecidas e ignoradas com segurança;
- ledger com o checksum canônico da `0002`;
- UUID e credencial da `ADMIN` preservados;
- sessão recuperada, ainda válida e reconhecida pelo Better Auth como `ADMIN`;
- 11 consultas reais do dashboard, catálogo, estoque, financeiro e vitrine;
- 15/15 testes de integração PostgreSQL aprovados;
- nenhuma FK inválida;
- as três diferenças estruturais corrigidas pela baseline canônica.

A senha não foi solicitada nem conhecida durante o ensaio ou a execução. A
credencial foi preservada byte a byte e a sessão foi reconhecida pelo Better
Auth; a proprietária pode confirmar manualmente a entrada com sua senha no
navegador sem compartilhá-la ou registrá-la em logs.

## Execução autorizada

Antes da transição, o backup foi restaurado novamente e comparado com o volume
original. O inventário estrutural e fingerprints não reversíveis de usuário,
conta, sessão e ledger foram idênticos, comprovando que não houve novas escritas
desde o backup aprovado.

A execução seguiu o plano ensaiado:

1. o servidor Next.js local foi encerrado;
2. foi confirmada a ausência de operações ativas no PostgreSQL original;
3. o Compose original foi parado sem remover volumes;
4. foi criado `collab-local-admin-reconciled-data`;
5. as migrations canônicas `0000`, `0001` e `0002` foram aplicadas pelo runner;
6. os dados foram restaurados sem copiar `collab_schema_migrations`;
7. UUID, credencial Better Auth, sessão, relacionamentos e contagens foram
   comparados com a restauração do backup;
8. o runner foi executado novamente e reconheceu as três migrations;
9. o Compose passou a apontar para o volume reconciliado somente depois dessas
   verificações.

O inventário final confirmou cinco tabelas, cinco enums, seis funções e
quatorze triggers financeiros, a constraint
`product_financial_costs_fixed_agreement`, nenhuma FK inválida e o checksum
canônico da `0002`. Testes transacionais revertidos confirmaram a regra fixa de
40%/50%/50% e a auditoria append-only sem persistir registros de teste.

O Next.js foi iniciado duas vezes pelo fluxo oficial. A sessão recuperada foi
reconhecida como `ADMIN`; dashboard, artistas, categorias, produtos, estoque,
financeiro e vitrine responderam por HTTP local. Um clone descartável do backup
pós-recuperação confirmou também a revogação da sessão pelo logout, sem revogar
a sessão do banco persistente.

### Backup pós-recuperação

Um segundo backup custom foi criado depois da transição. Sua assinatura,
inventário e SHA-256 foram validados, e a restauração foi concluída com sucesso
em PostgreSQL 18.7 descartável. O arquivo e seus identificadores operacionais
continuam privados e não fazem parte do repositório.

## Plano executado

A estratégia segura substituiu o ambiente local por um banco novo, em vez de
editar checksum ou aplicar fragmentos de DDL sobre o volume divergente:

1. reconfirmar a autorização, o backup e seu SHA-256;
2. impedir novas escritas e confirmar novamente a identidade do banco local;
3. preservar o volume `collab-local-admin-data` sem apagá-lo ou renomeá-lo;
4. criar um **novo volume** com nome de recuperação explícito;
5. aplicar as três migrations canônicas pelo runner protegido;
6. restaurar somente os dados da aplicação, excluindo o ledger anterior;
7. comparar contagens, IDs, credencial, FKs, objetos e comportamento;
8. iniciar o Next.js contra o novo volume e validar login, logout, painel,
   financeiro, vitrine e prévia privada;
9. alterar o Compose local para usar o volume recuperado somente depois de
   todas as verificações;
10. manter o volume original e o backup como rollback até novo aceite da
    proprietária.

Não serão usados `local:reset`, atualização manual de checksum, modificação das
migrations ou restauração sobre o banco existente.

## Rollback

Se uma verificação posterior identificar uma inconsistência:

1. parar apenas o Compose `collab-local-admin`;
2. definir temporariamente
   `COLLAB_LOCAL_DB_VOLUME_NAME=collab-local-admin-data` na sessão local;
3. iniciar somente o PostgreSQL e confirmar identidade e contagens por leitura;
4. manter o volume novo para diagnóstico, sem apagar nenhum dos dois;
5. não repetir a recuperação automaticamente.

O volume original contém propositalmente o checksum antigo. O guard atual deve
recusá-lo; não altere o ledger nem tente iniciar a aplicação sobre ele. Para
voltar ao banco reconciliado, remova a variável temporária e execute novamente
`npm run local:setup`.

Para uma inspeção de rollback, monte o volume original **somente para leitura
operacional**, sem chamar o runner:

```powershell
npm run local:stop
$env:COLLAB_LOCAL_DB_VOLUME_NAME = "collab-local-admin-data"
$collabLocalEnv = Join-Path $env:LOCALAPPDATA "COLLAB\local-admin\local.env"
$collabDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
& $collabDocker compose --env-file $collabLocalEnv -f compose.postgres-local-admin.yml -p collab-local-admin up --detach --wait
```

Depois da inspeção, encerre o contêiner sem volumes e retorne ao destino
reconciliado:

```powershell
& $collabDocker compose --env-file $collabLocalEnv -f compose.postgres-local-admin.yml -p collab-local-admin down
Remove-Item Env:COLLAB_LOCAL_DB_VOLUME_NAME
npm run local:setup
```

Não execute `local:start` enquanto o volume original estiver selecionado. Uma
restauração adicional ou nova troca de volumes exige outra autorização.

## Autorização

Status atual: **recebida e executada no escopo aprovado**.

A autorização não incluiu Railway, production, deploy, criação de outro
`ADMIN`, alteração das regras financeiras, commit ou push. Nenhuma dessas ações
foi executada.
