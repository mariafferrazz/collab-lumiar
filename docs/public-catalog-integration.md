# Integração do catálogo persistido com a vitrine pública

## Estado da etapa

A vitrine possui agora uma camada pública tipada e reutilizável. Ela pode operar
em dois modos explicitamente separados:

- `demo`: usa somente as fixtures locais já existentes e identifica todo o
  conteúdo como demonstrativo;
- `persisted-local`: lê somente o PostgreSQL 18 persistente da pré-visualização
  local, identificado como `COLLAB_LOCAL_DEVELOPMENT_DATABASE` em
  `127.0.0.1:55432`.

O comando `npm run local:start` seleciona `persisted-local` no processo do
Next.js e remove do ambiente as variáveis da Railway e de integrações externas.
Sem configuração explícita, a aplicação permanece em `demo`. Um valor inválido,
uma URL externa ou uma identidade de banco divergente interrompem a consulta; não
existe fallback silencioso nem mistura entre os modos.

Esta etapa não acessou Railway, não aplicou migrations e preservou integralmente
`0000`, `0001` e `0002`.

## Arquitetura

As páginas públicas são Server Components e chamam `publicCatalog`, em
`src/lib/server/catalog.ts`. Esse módulo resolve a fonte, valida o banco local e
delega para:

- `demo-catalog.ts`, adaptador das fixtures;
- `public-catalog-repository.ts`, consultas Drizzle/PostgreSQL;
- `public-query.ts`, validação de busca, filtros, ordenação e paginação;
- `public-catalog.ts`, contratos que contêm somente dados de apresentação.

Client Components nunca recebem conexão ou credenciais. Não foram criadas APIs
públicas novas. Os DTOs públicos não carregam custo do artista, adicional
comercial, participações, regras de taxas, tributos, auditoria ou dados pessoais.
Somente o preço final da mercadoria validado é selecionado.

## Critérios de publicação

Uma consulta pública exige simultaneamente:

1. produto com status `published` e data de publicação;
2. artista ativo;
3. ao menos uma categoria;
4. variação padrão ativa;
5. imagem principal cadastrada;
6. cenário financeiro padrão com status `validated`;
7. preço final do cenário exatamente igual ao preço público do produto.

Os triggers existentes continuam sendo a última barreira de integridade. As
consultas repetem os critérios relevantes para que rascunhos, arquivados ou dados
inconsistentes não sejam expostos mesmo diante de uma leitura isolada.

## Produtos, preço e estoque

`/produtos` oferece busca por produto ou artista, filtro por categoria e
disponibilidade, ordenação por novidade, nome e preço e paginação no servidor.
O limite público é de 24 itens por página e toda ordenação possui desempate
estável por nome/ID.

`/produtos/[slug]` recebe nome, descrição, artista, categorias, imagens,
variações ativas, estoque agregado, preço aprovado e o perfil logístico público.
O estoque é somente leitura: visualizar a página não reserva nem reduz saldo.
Produtos esgotados continuam visíveis e claramente identificados; rascunhos e
arquivados retornam `404` publicamente.

O navegador não recalcula preço. A regra de custo + 40%, a divisão 50/50, taxas
e tributos permanecem no domínio financeiro do servidor. O frete segue separado
e nenhuma cotação ou checkout foi implementado.

## Artistas e categorias

`/artistas` lista apenas artistas ativos e permite busca e paginação. A página
individual exibe biografia, fotografia pública quando existir, Instagram
profissional autorizado e somente produtos publicados. O schema atual não tem
slug de artista; por isso, perfis persistidos usam o UUID estável no segmento da
URL sem derivar identificadores mutáveis do nome.

`/categorias` e `/categorias/[slug]` são dinâmicas. Categorias aparecem somente
quando elas ou alguma descendente possuem produto público. As contagens são
calculadas apenas com produtos elegíveis, incluem descendentes sem duplicar
produtos e não revelam vínculos de rascunhos. Categorias vazias permanecem
ocultas; uma URL sem conteúdo público retorna `404`.

## Imagens

As fixtures usam apenas arquivos versionados sob `/images`. O banco aceita
somente referências internas no formato já validado pelo painel, mas o provedor
definitivo de armazenamento ainda não existe. Portanto, a vitrine persistida não
transforma caminhos privados em URLs nem improvisa filesystem público: apresenta
um estado visual neutro de imagem ausente, com texto alternativo cadastrado.

Quando um armazenamento autorizado for escolhido, a resolução de referência
deverá ocorrer no servidor, com política de acesso e direitos de uso revisados.

## Home e estados de erro

A home usa os quatro produtos públicos mais recentes, até quatro artistas ativos
e categorias visíveis. Não existe ranking artificial, popularidade ou avaliação
fictícia. Um catálogo vazio mantém o layout e apresenta mensagens honestas.

Falhas de configuração ou banco são propagadas para uma tela de erro controlada,
sem URL, SQL, credencial ou fallback demonstrativo. O usuário pode tentar
novamente depois que o PostgreSQL local estiver disponível.

## Prévia administrativa

`/admin/produtos/[id]/preview` reutiliza a apresentação do detalhe público, mas:

- revalida `requireAdminSession()` no servidor;
- exige o banco local explicitamente identificado;
- aguarda uma conexão de requisição, sem cache público;
- declara `noindex`, `nofollow` e `nocache`;
- não importa Server Actions nem oferece mutações;
- mostra rascunhos, preço somente quando validado e as pendências de publicação.

Não há `?admin=true`, URL secreta, bypass ou link compartilhável sem sessão. O
layout administrativo também mantém sua verificação normal de papel.

## Atualização após edições

As Server Actions administrativas continuam autorizando o operador perto da
mutação. Depois de criar ou alterar artistas, categorias, produtos, estoque,
imagens, logística ou precificação, `revalidatePath` invalida a home, listagens e
rotas dinâmicas públicas. As leituras PostgreSQL não usam cache compartilhado;
a invalidação também atualiza shells e navegações já visitadas no App Router.

Dados privados de prévia nunca recebem tag ou cache público.

## Desempenho

As listagens executam filtros, ordenação, contagem e paginação no PostgreSQL. A
consulta de produtos agrega categoria, imagem principal e estoque sem uma query
por card. Artistas usam contagem correlacionada pública e categorias são
resolvidas em duas consultas totais, com a hierarquia montada no servidor.

O benchmark `npm run perf:database` mede as novas superfícies usando somente o
banco local. Com o banco atualmente vazio, os números medem overhead e quantidade
de queries, não desempenho com volume representativo. Uma nova medição com
`EXPLAIN (ANALYZE, BUFFERS)` só deve ocorrer depois que existirem dados de teste
em cardinalidade realista; nenhum índice especulativo foi criado.

Medição local de 19/11/2026, PostgreSQL 18.7, seis amostras por operação:

| Superfície    | Primeira leitura | Mediana aquecida | Queries aquecidas |
| ------------- | ---------------- | ---------------- | ----------------- |
| `/`           | 105,42 ms        | 15,32 ms         | 6                 |
| `/produtos`   | 30,70 ms         | 12,12 ms         | 4                 |
| `/artistas`   | 7,39 ms          | 7,13 ms          | 2                 |
| `/categorias` | 8,88 ms          | 9,02 ms          | 2                 |

A primeira leitura da home inclui uma verificação adicional de identidade do
banco; as seguintes reutilizam essa validação no processo. Não há query por card.

## Configuração e validação manual

1. Abra o Docker Desktop.
2. Execute `npm run local:start`.
3. Entre em `http://localhost:3000/entrar` com a conta ADMIN local.
4. Cadastre manualmente artista, categoria e produto de teste.
5. Use **Ver prévia privada** antes de publicar.
6. Configure e valide a precificação apenas com regras de desenvolvimento
   conscientemente cadastradas; não invente alíquotas reais.
7. Atenda categoria, variação padrão e imagem principal.
8. Publique e abra `/produtos`, `/artistas` e `/categorias`.
9. Arquive o produto e confirme que ele deixa de aparecer publicamente.
10. Encerre com `npm run local:stop`.

## Limitações e pendências

- armazenamento definitivo e entrega pública das imagens;
- conteúdo real autorizado e direitos de uso;
- taxas reais do Mercado Pago e regime tributário do CNPJ;
- emissão fiscal, domínio e e-mail transacional real;
- slug público específico para artistas, caso seja aprovado em migration futura;
- teste de desempenho com volume representativo.

Essas pendências não foram simuladas nem preenchidas automaticamente.
