# Pré-visualização local do painel administrativo

Este ambiente existe apenas para acompanhar o desenvolvimento da COLLAB no
computador da proprietária. Ele usa PostgreSQL 18 no Docker, autenticação real
do Better Auth e dados persistentes exclusivamente locais. Não acessa Railway,
não envia e-mails e não publica a loja.

## O que fica no computador

- banco `collab_local_admin`, publicado somente em `127.0.0.1:55432`;
- volume Docker ativo `collab-local-admin-reconciled-data`;
- volume original `collab-local-admin-data` preservado somente para rollback;
- configuração privada em
  `%LOCALAPPDATA%\COLLAB\local-admin\local.env`, fora do Git e do OneDrive;
- uma única conta `ADMIN`, criada interativamente pelo Better Auth;
- artistas, categorias, produtos e demais registros cadastrados manualmente.

O banco descartável dos testes de integração é separado e continua sendo
removido ao final dos testes.

## Primeira utilização

### 1. Abrir o Docker Desktop

Abra o Docker Desktop pelo menu do Windows e espere a indicação de que o motor
está pronto. Não é necessário abrir portas nem ativar compartilhamento público.

### 2. Preparar o banco local

No terminal aberto na pasta do projeto, execute:

```powershell
npm run local:setup
```

O comando cria a configuração privada se ela ainda não existir, inicia somente
o Compose `collab-local-admin`, confere PostgreSQL 18 e aplica, em transação, as
migrations íntegras `0000`, `0001` e `0002`. Repetir o comando é seguro: o ledger
impede reaplicação.

### 3. Criar a administradora local

Execute uma única vez:

```powershell
npm run local:admin:create
```

Informe nome e e-mail no terminal. A senha é solicitada duas vezes sem aparecer
na tela ou no histórico do shell. O provisionador usa
`auth.api.createUser()` da versão Better Auth instalada, cria o hash oficial,
define `ADMIN`, marca a conta local como verificada e testa login e logout. Ele
não envia e-mail e recusa uma segunda conta administrativa.

Não use senha de Railway, e-mail corporativo de terceiros ou qualquer
credencial reutilizada. Esses dados servem somente para este computador.

### 4. Iniciar a aplicação

```powershell
npm run local:start
```

Mantenha esse terminal aberto. O Next.js escuta exclusivamente em `127.0.0.1` e
atualiza a interface durante alterações no código. O comando também solicita
`/entrar` e `/` uma vez, somente por loopback e sem sessão, para antecipar a
primeira compilação pública. Espere a mensagem `Prévia pública aquecida` antes
de abrir o navegador; se esse aquecimento não concluir, o terminal informa que
o primeiro acesso poderá compilar a página normalmente.

O mesmo comando seleciona `CATALOG_DATA_SOURCE=persisted-local` apenas no
processo local. A vitrine passa a ler o PostgreSQL em `127.0.0.1:55432`, depois
de conferir seu marcador e a versão principal 18. Variáveis da Railway são
removidas desse processo.

Abra [http://localhost:3000/entrar](http://localhost:3000/entrar), entre com a
conta local e acesse [http://localhost:3000/admin](http://localhost:3000/admin).

Use exatamente `localhost` no navegador. Embora o servidor escute apenas no
loopback `127.0.0.1`, o Better Auth considera `http://localhost:3000` a origem
canônica configurada. Abrir a página por `http://127.0.0.1:3000` faz a proteção
de origem recusar a operação com `403 / INVALID_ORIGIN`.

Em desenvolvimento, uma tentativa recusada registra no console do navegador
somente `code`, `status` e `statusText` do Better Auth. O diagnóstico nunca
inclui e-mail, senha, cookie ou token. Credencial inválida e e-mail não
verificado continuam exibindo a mesma mensagem pública para não permitir a
descoberta de contas.

Uma faixa vinho informa **DESENVOLVIMENTO LOCAL**. Se ela não aparecer, não
cadastre dados e encerre o servidor.

## Navegação do painel

- **Visão geral:** indicadores do catálogo local e pendências;
- **Artistas:** cadastro, edição e ativação;
- **Categorias:** hierarquia, busca, ordenação e filtros;
- **Produtos:** dados básicos, variações, imagens e logística;
- **Estoque:** atualização concorrente por produto e SKU;
- **Financeiro:** políticas, encargos e cenários de preço;
- **Sair da conta:** encerra a sessão Better Auth pelo menu administrativo.

Visitantes são enviados ao login. Contas `CUSTOMER` não acessam `/admin`, e
toda ação administrativa revalida a sessão no servidor.

## Cadastrar um produto de teste

1. Crie manualmente um artista com nome claramente demonstrativo.
2. Crie uma categoria de teste.
3. Em **Produtos**, escolha **Novo produto** e mantenha-o como rascunho.
4. Cadastre variação, estoque, metadados de imagem e logística na página do
   produto. O upload real de imagem ainda não está configurado.
5. Use **Ver prévia privada** para revisar o rascunho e suas pendências.
6. Informe o custo do artista e selecione apenas políticas e encargos que você
   cadastrou conscientemente no Financeiro.
7. Valide o cenário antes de tentar publicar. Não trate esses registros como
   vendas, receitas ou repasses reais.
8. Depois de publicar, confirme o produto em `/produtos`, no perfil do artista e
   na página da categoria. Arquivar ou voltar a rascunho remove o item da vitrine.

O sistema não cria produtos, taxas, tributos ou vendas fictícias
automaticamente.

### Se o guard indicar migration modificada

Interrompa a inicialização. Não edite o ledger, não reaplique o SQL e não apague
o volume para superar a mensagem. Compare o checksum registrado com o manifesto,
confirme a origem da divergência e prepare backup antes de qualquer correção. A
reconciliação do banco local exige autorização específica, mesmo quando os
objetos aparentarem compatibilidade. O diagnóstico atual e o plano de
recuperação estão em
[Reconciliação do PostgreSQL local](local-database-reconciliation.md).

A divergência identificada em novembro de 2026 foi recuperada em um volume novo
e o Compose usa o banco reconciliado por padrão. A conta `ADMIN` foi preservada;
não execute `local:admin:create` novamente.

## Acessar o Financeiro

Neste fluxo, a migration `0002_collab_financial_pricing` é aplicada somente no
banco local; o comando não acessa nem modifica ambientes remotos. Acesse
`/admin/financeiro` para cadastrar política, taxa e regra tributária de
desenvolvimento. As fórmulas comerciais permanecem as descritas em
[Modelo financeiro](financial-model.md); nenhuma alíquota real é presumida.

## Ver alterações feitas no código

Com `npm run local:start` ativo, o Next.js usa atualização rápida. Depois que o
Codex salvar uma mudança, aguarde a recompilação indicada no terminal e atualize
o navegador se a tela não mudar automaticamente. Dados cadastrados permanecem
no volume Docker.

## Encerrar com segurança

1. No terminal do Next.js, pressione `Ctrl+C`.
2. Execute:

```powershell
npm run local:stop
```

O comando encerra apenas o Compose identificado como `collab-local-admin` e
preserva o volume. Ele não desliga outros contêineres do Docker Desktop.

Para consultar o estado:

```powershell
npm run local:status
```

## Recuperar o acesso local

Se a senha for perdida, não altere hashes e não promova usuários por SQL. Como
este ambiente contém somente dados de desenvolvimento, o procedimento
autorizado é limpar o volume local e provisionar novamente:

```powershell
npm run local:reset
```

O comando só remove dados depois que a frase exata de confirmação for digitada.
Depois, repita `local:setup` e `local:admin:create`. Essa limpeza é irreversível
para os cadastros locais e nunca deve ser executada sem confirmação da
proprietária.

## Como o isolamento é garantido

- endpoint fixo `127.0.0.1:55432`, banco e usuário com nomes locais exclusivos;
- marcador interno `COLLAB_LOCAL_DEVELOPMENT_DATABASE`;
- PostgreSQL principal obrigatoriamente na versão 18;
- manifesto SHA-256, transação, advisory lock e ledger de migrations;
- processo local remove variáveis Railway e integrações externas do ambiente;
- cadastro público e transporte de e-mail permanecem desabilitados;
- Next.js vinculado a `127.0.0.1`, sem túnel público;
- nenhum comando Railway, deploy, commit ou push integra essa rotina.

Se qualquer host, porta, identidade, versão ou marcador divergir, a preparação
falha antes de gravar dados.
