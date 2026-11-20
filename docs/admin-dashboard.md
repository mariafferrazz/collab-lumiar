# Painel administrativo

## Estado desta etapa

O painel administrativo da COLLAB LUMIAR foi implementado sobre o schema
existente de catálogo e autenticação. Ele não está publicado em produção e não
há um usuário `ADMIN` remoto provisionado. Uma conta real, restrita ao banco
local isolado, permite a pré-visualização pela proprietária. As rotas permanecem
inacessíveis para visitantes e clientes `CUSTOMER`.

O módulo financeiro utiliza a migration versionada
`0002_collab_financial_pricing`. Os SQLs `0000_collab_catalog` e
`0001_collab_auth`, seus checksums e o mecanismo de migrations foram
preservados. A `0002` foi validada em PostgreSQL 18 descartável e aplicada de
forma controlada somente na Railway `development`, depois de backup,
restauração, preflight e autorização explícita.

## Rotas

| Rota                            | Responsabilidade                                        |
| ------------------------------- | ------------------------------------------------------- |
| `/admin`                        | indicadores reais, itens recentes, pendências e atalhos |
| `/admin/artistas`               | busca, filtro, paginação e estado dos artistas          |
| `/admin/artistas/novo`          | cadastro de artista                                     |
| `/admin/artistas/[id]`          | detalhes, produtos associados e ativação/desativação    |
| `/admin/artistas/[id]/editar`   | edição de artista                                       |
| `/admin/categorias`             | busca, hierarquia, ordenação e proteção de vínculos     |
| `/admin/categorias/nova`        | cadastro de categoria                                   |
| `/admin/categorias/[id]/editar` | edição e remoção protegida                              |
| `/admin/produtos`               | busca, filtro por publicação e paginação                |
| `/admin/produtos/novo`          | criação inicial em rascunho                             |
| `/admin/produtos/[id]`          | revisão, publicação, variações, imagens e logística     |
| `/admin/produtos/[id]/editar`   | edição de dados básicos e categorias                    |
| `/admin/estoque`                | busca por produto/SKU e atualização concorrente         |
| `/admin/financeiro`             | políticas, taxas, tributos e precificação               |

O layout oferece menu lateral no desktop, navegação expansível no mobile,
breadcrumbs, estados vazios, carregamento, mensagens acessíveis e confirmações
para ações destrutivas.

## Autorização

- o proxy redireciona visitantes sem cookie para o login;
- cada página chama `requireAdminSession()` no servidor;
- o layout também revalida a sessão e o papel;
- cada Server Action chama `requireAdminSession()` antes de ler ou alterar
  dados;
- o papel `ADMIN` é lido da sessão do Better Auth e nunca do formulário;
- não existe parâmetro, cookie de desenvolvimento ou senha fixa que ignore a
  autorização;
- erros conhecidos do PostgreSQL são convertidos em mensagens seguras, sem SQL,
  nomes internos ou dados da conexão.

O cadastro público continua desabilitado. Usuários `ADMIN` usados nos testes são
criados no PostgreSQL descartável e eliminados junto com o contêiner. Para
pré-visualização manual, uma única conta pode ser provisionada no PostgreSQL
local persistente pelo procedimento de
[Pré-visualização local](local-admin-preview.md), sem acessar Railway.

## Fluxos e validações

### Artistas

O painel cadastra e edita nome artístico, biografia, identificador público do
Instagram, caminho controlado de foto e estado ativo. Artistas não são excluídos:
a desativação preserva produtos e histórico.

### Categorias

Nome, slug, descrição, categoria principal e ordem são validados no servidor.
Slugs duplicados, autorreferência, ciclos, categorias com descendentes e
categorias vinculadas a produtos são bloqueados pela aplicação e/ou pelas
restrições PostgreSQL. O schema não possui um campo ativo, portanto ativação e
desativação de categorias não foram inventadas.

### Produtos, preços e variações

Produtos são criados como `draft`. Preços são interpretados como texto decimal
e convertidos para centavos inteiros sem aritmética monetária de ponto
flutuante. Artista e categorias são conferidos no banco antes da gravação, e a
associação N:N é atualizada em transação.

Variações aceitam SKU, cor, tamanho, preço específico, quantidade, estado e
marcação padrão. O índice único e os checks existentes impedem SKU duplicado,
estoque negativo e múltiplas variações padrão. A publicação usa os triggers
existentes e só conclui com categoria, variação padrão ativa, imagem principal e
campos obrigatórios.

### Estoque

Cada ajuste usa o `updated_at` e a quantidade originalmente observados como
versão otimista e roda em transação `serializable`. Se outro ajuste vencer a
corrida, nenhuma quantidade é sobrescrita e o operador precisa atualizar a
tela. O schema ainda não possui histórico de movimentações; auditoria de
ajustes, reservas e baixa por venda são pendências futuras.

### Imagens

`CatalogImageStorage` define o contrato de armazenamento. O adaptador atual é
deliberadamente indisponível: ele nunca simula upload bem-sucedido. A interface
permite revisar galeria, imagem principal, ordem, texto alternativo e remover o
vínculo de metadados com confirmação.

Caminhos aceitos seguem o padrão interno
`catalog/<uuid-do-produto>/<arquivo>.{avif,jpg,jpeg,png,webp}`. URLs arbitrárias,
travessia de diretórios, Supabase Storage, binários no PostgreSQL e filesystem
efêmero não são aceitos. A visualização e o upload real dependem de um provedor
privado autorizado e de política de acesso assinada.

### Logística

Há perfis para produto e para variação, com peso e dimensões separados entre o
item e a embalagem pronta. Fragilidade, envio separado e unidades por embalagem
respeitam os checks do banco. Nenhuma cotação ou chamada ao Melhor Envio é feita.

### Financeiro

O painel registra políticas versionadas, taxas de pagamento, tributos, custo do
artista e cenários de preço por produto ou variação. O servidor aplica o
adicional fixo de 40% sobre o custo, divide esse adicional igualmente entre
proprietária e organizadora e mantém taxas, tributos e frete fora da divisão.
Um cenário só altera o preço do catálogo após validação explícita de `ADMIN`.
O banco também impede publicar uma variação ativa com preço específico sem custo
e cenário validados, além de conferir a decomposição fixa de 40%/50%/50%.

As áreas de vendas, repasses, despesas, conciliação e relatórios exibem estados
vazios honestos porque ainda não existem pedidos ou transações reais. Nenhum
dado financeiro interno integra o payload do catálogo público. Fórmulas,
arredondamentos, limitações e validações profissionais pendentes estão em
[Modelo financeiro](financial-model.md).

## Catálogo público

As páginas públicas usam uma fonte explícita: fixtures identificadas em `demo`
ou o PostgreSQL isolado em `persisted-local`. O comando `local:start` seleciona
o catálogo persistido e valida URL, marcador e PostgreSQL principal 18 antes da
primeira leitura. Falhas não recorrem às fixtures e os dois modos nunca são
mesclados.

Produtos públicos precisam estar `published`, pertencer a artista ativo e ter
categoria, variação padrão ativa, imagem principal e cenário financeiro padrão
validado com preço reconciliado. Artistas e categorias são dinâmicos; contagens
ignoram rascunhos e arquivados. Busca, filtros, ordenação e paginação ocorrem no
servidor.

A rota `/admin/produtos/[id]/preview` é somente leitura, exige `ADMIN`, não usa
cache público e exibe pendências sem enfraquecer os triggers. Consulte
[Integração do catálogo público](public-catalog-integration.md).

## Testes

Os testes unitários cobrem validações de slug, moeda, UUID, SKU, estoque,
imagem, logística, cálculo financeiro inteiro, gross-up, arredondamentos,
adaptador indisponível e a presença da revalidação de `ADMIN` em todas as
Server Actions.

No PostgreSQL 18 descartável, a suíte executa as migrations e valida o CRUD do
painel, relações, publicação, arquivamento, slug duplicado, categoria vinculada,
ciclo, desativação de artista, concorrência de estoque, consulta pública e
permissões reais `CUSTOMER`/`ADMIN` do Better Auth. Nenhuma fixture de teste usa
a Railway.

## Limitações atuais

- o `ADMIN` de pré-visualização existe somente no banco local e não representa
  uma conta de produção;
- upload e pré-visualização real dependem de armazenamento ainda não escolhido;
- imagens persistidas exibem estado neutro até existir armazenamento autorizado;
- ajustes de estoque não possuem ledger próprio;
- não existem pedidos, pagamentos, reservas, repasses ou métricas de vendas;
- Resend real, Mercado Pago e Melhor Envio permanecem desconectados;
- o painel não está disponível em produção.

Para uso no ambiente `development`, ainda serão necessários autorização
explícita, provisionamento controlado do primeiro `ADMIN`, configuração local de
`DATABASE_URL`/Better Auth e armazenamento privado aprovado. Isso não autoriza
deploy nem mudanças em Railway.
