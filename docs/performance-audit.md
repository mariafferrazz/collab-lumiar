# Auditoria de performance

Data da medição: 19 de novembro de 2026.

## Resumo executivo

A lentidão percebida foi reproduzida e está concentrada no ambiente de
desenvolvimento do Next.js, especialmente na primeira compilação e no runtime de
HMR. O PostgreSQL local, as consultas atuais e as imagens não apareceram como
gargalos dominantes no conjunto de dados local.

O build otimizado local apresentou, na home aquecida, mediana de 45,5 ms de
TTFB e 294 ms de LCP. No `next dev`, as medianas equivalentes foram 749 ms e
1.150 ms. O JavaScript codificado do primeiro carregamento caiu de 817.618 bytes
no desenvolvimento para 157.512 bytes no build otimizado. Essa diferença é
esperada: o desenvolvimento inclui HMR, metadados, validações e módulos não
minificados.

Foi implementado um pré-aquecimento local de baixo risco para `/entrar` e `/`.
Ele antecipa a compilação dessas páginas depois de `npm run local:start`, sem
cookie, sem bypass de autenticação e aceitando apenas loopback. Rotas
administrativas continuam protegidas e não são aquecidas sem sessão.

## Ambiente medido

- Windows, projeto em pasta sincronizada pelo OneDrive;
- Node.js 24.14.1 e npm 11.11.0;
- Next.js 16.4.6 com Turbopack, Cache Components e Partial Prefetching;
- React 19.3.0;
- PostgreSQL 18 local em Docker, publicado apenas em `127.0.0.1:55432`;
- servidor de desenvolvimento em `127.0.0.1:3000`;
- banco local com uma conta administrativa e sem registros de domínio;
- nenhum acesso à Railway ou a production.

## Metodologia e limitações

Foram usados cinco tipos de medição:

1. requisições HTTP repetidas com TTFB, tempo total, status e bytes;
2. navegador Brave headless via Chrome DevTools Protocol, com navegação,
   FCP, LCP, CLS e recursos;
3. build de produção em diretório isolado, sem substituir o `.next` do servidor;
4. consultas reais somente leitura no PostgreSQL local, com contagem de queries;
5. inventário estático de Client Components, imagens, índices e chunks.

O INP não foi informado porque não houve uma interação representativa e
repetível. A auditoria não inventa esse número. As rotas administrativas não
receberam cookie por script e, portanto, o benchmark HTTP automatizado confirmou
apenas o redirecionamento de visitante. A autenticação real permanece necessária
para uma rodada visual complementar das páginas privadas.

O comando oficial `next analyze --output --snapshot` foi tentado duas vezes,
incluindo `--experimental-app-only`. Na versão instalada, em Windows, a captura
terminou sem `route-summaries.json`. O erro foi registrado e a análise usou como
alternativa o build oficial, os manifests, os chunks emitidos e a rede real do
navegador. Nenhuma biblioteca adicional foi instalada.

## Linha de base da home

Métricas do navegador, sem limitação artificial de CPU ou rede:

| Modo               | Estado                                  |     TTFB |  FCP/LCP |   `load` |     CLS |
| ------------------ | --------------------------------------- | -------: | -------: | -------: | ------: |
| `next dev`         | primeira amostra da instância existente | 2.121 ms | 3.208 ms | 3.940 ms | 0,00001 |
| `next dev`         | mediana aquecida                        |   749 ms | 1.150 ms | 1.315 ms |       0 |
| `next start` local | primeira amostra                        |   135 ms | 1.188 ms | 1.645 ms |       0 |
| `next start` local | mediana aquecida                        |  45,5 ms |   294 ms |   398 ms |       0 |

Comparando as medianas aquecidas, o build otimizado reduziu aproximadamente:

- TTFB: 93,9%;
- LCP: 74,4%;
- evento `load`: 69,7%.

Em cache vazio, numa cópia temporária fora do OneDrive, a primeira home registrou
14.325 ms de TTFB e 15.844 ms de LCP no navegador. O log do servidor atribuiu
4,0 s à resposta: 1.424 ms ao Next.js e 2,6 s ao código da aplicação. As
respostas seguintes do servidor variaram de 0,9 a 1,6 s. O pré-aquecimento agora
move esse custo inicial para o momento posterior ao start; o ganho completo no
navegador não foi atribuído ao aquecimento porque as visitas seguintes também
se beneficiam do cache de JavaScript e imagens do próprio browser.

O build otimizado compilou em 52 s, a checagem TypeScript levou 54 s e a geração
de 43 páginas levou 13,2 s. O `next start` isolado ficou pronto em 568 ms.

## Rotas e banco de dados

O `SELECT 1` teve mediana aquecida de 0,73 ms. Os serviços das páginas privadas
foram executados diretamente contra o banco local validado pelo mesmo guard do
ambiente administrativo:

| Página              | SELECTs aquecidos | Mediana aquecida |
| ------------------- | ----------------: | ---------------: |
| `/admin`            |                 7 |         20,13 ms |
| `/admin/artistas`   |                 2 |          7,67 ms |
| `/admin/categorias` |                 3 |          9,65 ms |
| `/admin/produtos`   |                 2 |          7,09 ms |
| `/admin/estoque`    |                 2 |          7,44 ms |
| `/admin/financeiro` |                 7 |         13,41 ms |

O primeiro dashboard pagou a abertura do pool e levou 132 ms. O cliente mantém
no máximo cinco conexões e é reutilizado em desenvolvimento. Listagens usam
paginação no banco; contagem e dados são buscados em paralelo. Dashboards e
detalhes também paralelizam consultas independentes. Não foi encontrado N+1 nas
listagens auditadas.

As tabelas de domínio estavam vazias. Nesse volume, `EXPLAIN ANALYZE` escolheria
varreduras sequenciais baratas e não produziria evidência válida para uma nova
migration. Os índices atuais cobrem chaves de autenticação, relacionamentos,
status, validade financeira e estoque. Nenhum índice ou schema foi alterado.

## Bundles e componentes cliente

O build gerou 24 chunks estáticos, 770.670 bytes brutos no total. Para a home:

- JavaScript referenciado: 593.876 bytes brutos e 182.309 bytes em gzip;
- CSS: 54.043 bytes brutos e 9.580 bytes em gzip;
- HTML: 44.085 bytes brutos e 6.531 bytes em gzip;
- rede real do primeiro carregamento otimizado: 157.512 bytes de JavaScript
  codificado em oito requisições.

Maiores chunks brutos identificados:

| Responsável                                     | Tamanho bruto |
| ----------------------------------------------- | ------------: |
| runtime React DOM                               | 229.082 bytes |
| scheduler/runtime React                         | 164.482 bytes |
| polyfills do Next.js                            | 112.594 bytes |
| CSS global                                      |  54.043 bytes |
| código compartilhado da aplicação               |  36.836 bytes |
| runtime cliente do Next.js                      |  35.308 bytes |
| Better Auth, somente em rotas que precisam dele |  33.753 bytes |

Há 14 limites `use client`, concentrados em formulários, erro, logout e cliente
de autenticação. Header, footer, vitrine, cards, shell administrativo e páginas
permanecem Server Components. Não há biblioteca de ícones; os SVGs são locais.
Postgres.js, Drizzle, Resend e módulos server-only não apareceram nos chunks do
navegador. O código administrativo não foi incluído como chunk específico na
home.

## Imagens e arquivos estáticos

O diretório `public/` contém seis imagens, aproximadamente 1,2 MB no total:

| Arquivo                  |   Dimensões |        Origem |
| ------------------------ | ----------: | ------------: |
| `papel-gravura.webp`     | 1200 × 1200 | 333.722 bytes |
| `textil-rios.webp`       | 1200 × 1200 | 258.196 bytes |
| `artistas-coletivo.webp` |  2000 × 667 | 221.860 bytes |
| `hero-serra.webp`        |  1672 × 941 | 211.396 bytes |
| `ceramica-serra.webp`    | 1200 × 1200 | 152.342 bytes |
| `collab-logo.png`        |   437 × 135 |  59.151 bytes |

As imagens locais usam `next/image`, `sizes` responsivo, lazy loading fora da
primeira dobra e preload apenas no hero. No build otimizado, o navegador recebeu
48.528 bytes codificados nas duas imagens iniciais e 113.580 bytes para cinco
imagens depois de completar a página. As fontes WebP não são entregues
integralmente nessas posições. Não houve evidência para recomprimir ou degradar
as artes, e nenhum arquivo visual foi modificado.

A única tag `<img>` é usada pelo feed oficial do Instagram porque a API pode
retornar hosts temporários variados. Ela continua lazy, com dimensões explícitas
e sem scraping.

## Cache, privacidade e invalidação

O painel usa sessão e autorização no servidor. `readSession()` está envolvido em
`React.cache`, deduplicando a leitura quando layout e página exigem a mesma
sessão dentro de uma renderização. Dados administrativos e financeiros não
receberam cache compartilhado.

As Server Actions continuam revalidando as rotas afetadas depois de alterações.
O feed do Instagram permanece dinâmico e sem cache de credenciais. Uma tentativa
de pré-renderizar o estado sem token piorou o TTFB nas rodadas comparativas e foi
integralmente revertida; nenhuma mudança de cache do feed foi mantida.

## Ambiente local, processos e OneDrive

Depois dos testes temporários, somente `127.0.0.1:3000` e o PostgreSQL local em
`127.0.0.1:55432` permaneceram ativos; as portas 3101, 3102 e 3103 foram
encerradas. O servidor Next.js registrou 488,2 MB de working set e 500,6 MB de
memória privada. Havia 11 processos Node no computador, somando 895,1 MB de
working set, mas esse total inclui o Codex e outras ferramentas. Não foi
encontrada segunda instância Next ouvindo uma porta da COLLAB.

O processo do OneDrive usava 451,1 MB no momento da coleta. `node_modules` e
`.next` possuem centenas de megabytes e milhares de arquivos, o que pode ampliar
o custo de watchers e antivírus. Entretanto, a cópia temporária fora do OneDrive
não melhorou as respostas aquecidas e ainda reproduziu o cold start lento. A
sincronização é um fator possível, mas não foi confirmada como causa principal;
por isso o projeto não foi movido e nenhuma proteção do Windows foi desativada.

## Melhorias implementadas

- pré-aquecimento loopback-only de `/entrar` e `/` no `local:start`;
- fallback seguro: uma falha no aquecimento não derruba a aplicação;
- teste automatizado do aquecimento e da recusa de destinos externos;
- benchmark HTTP reutilizável, restrito a servidor e PostgreSQL locais;
- benchmark de consultas por página, validado pelo guard do banco local;
- coletor de Web Vitals via navegador headless, sem dependência nova;
- relatório de chunks gerados pelo build;
- diretório de build alternativo estritamente validado para não interferir no
  `.next` ativo;
- caches `.next-performance-*` ignorados pelo Git.

Não foram alteradas regras financeiras, permissões, autenticação, migrations,
imagens, schema ou dados.

## Riscos e próximas recomendações

1. Repetir as medições administrativas depois de login manual, sem extrair ou
   registrar cookies. O benchmark de banco já cobre o custo das consultas, mas
   LCP/CLS/navegação privados dependem de sessão real.
2. Repetir `EXPLAIN (ANALYZE, BUFFERS)` quando existirem dados de teste em volume
   representativo. Índices novos sem cardinalidade seriam especulativos.
3. Usar `npm run local:start`, aguardar `Prévia pública aquecida` e aceitar que o
   hot reload do desenvolvimento continuará mais lento que o build otimizado.
4. Avaliar uma cópia de trabalho definitiva fora do OneDrive somente se novas
   medições, no mesmo hardware e sem processos concorrentes, demonstrarem ganho
   consistente. Qualquer migração exige autorização e cópia segura de Git,
   arquivos ignorados e configuração local.
5. Investigar novamente `next analyze` após uma atualização deliberada do
   Next.js; nenhuma dependência foi atualizada apenas para contornar a falha da
   ferramenta experimental.

## Arquivos da etapa

- `next.config.ts`;
- `.gitignore`;
- `package.json`;
- `scripts/local-admin.ts`;
- `scripts/lib/local-preview-warmup.mjs`;
- `scripts/performance-benchmark.mjs`;
- `scripts/performance-browser.mjs`;
- `scripts/performance-build-report.mjs`;
- `scripts/performance-database.ts`;
- `tests/local-preview-warmup.test.ts`;
- `docs/local-admin-preview.md`;
- `docs/performance-audit.md`.

Os resultados das validações finais desta etapa devem ser lidos no relatório de
entrega junto com este documento; nenhum deploy, commit ou push faz parte da
auditoria.
