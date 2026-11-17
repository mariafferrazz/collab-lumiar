<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# COLLAB: regras permanentes do projeto

## Escopo, idioma e arquitetura

- Mantenha todo o código da loja dentro deste diretório `collab/`; não altere
  projetos irmãos em `gabi/`.
- Use Next.js App Router, TypeScript estrito, Tailwind CSS e, quando solicitado,
  Supabase (PostgreSQL, Auth e Storage), com versões estáveis e documentação
  oficial atual.
- A interface e o conteúdo são em pt-BR, os valores em BRL e o fuso comercial é
  `America/Sao_Paulo`. Priorize celular, acessibilidade, SEO, desempenho,
  manutenção simples e segurança de operação comercial.
- Trabalhe somente na etapa solicitada. Preserve funcionalidades, contratos de
  API e esquema de banco; mudanças de esquema exigem migração versionada e
  compatível. Não refatore fora do escopo sem justificativa.
- Antes de editar, leia `AGENTS.md`, `README.md`, `package.json`, a estrutura do
  projeto e as migrações existentes. Apresente plano curto e arquivos previstos.
- Prefira alterações pequenas e verificáveis. Evite `any`, dependências
  desnecessárias, código morto e segredos no código.

## Segurança e integrações

- Somente `.env.example`, com valores vazios, pode ser versionado. Nunca adicione
  `.env`, `.env.local`, arquivos por ambiente, credenciais, chaves, certificados
  privados, dumps ou backups ao Git.
- Trate toda variável `NEXT_PUBLIC_` como pública e incorporável ao bundle. Use
  esse prefixo apenas para URL pública e chave publicável do Supabase. Toda
  credencial privada deve ter nome sem esse prefixo e permanecer no servidor.
- Módulos que acessam segredos devem importar `server-only` e usar o helper em
  `src/lib/server/env.ts`. Eles não podem ser importados por componentes client.
- Nunca exponha segredos via `next.config.ts`, props serializadas, respostas de
  API, mensagens de erro, telemetria ou logs. Nunca copie valores sensíveis para
  relatórios, issues, pull requests ou documentação.
- Valide entradas no servidor, trate erros, autorize por recurso, habilite RLS
  no Supabase, limite requisições em endpoints sensíveis e não registre dados
  pessoais sensíveis.
- Nunca envie ao navegador service-role key, tokens privados de redes sociais,
  chaves privadas de pagamento ou de frete. Documente configurações em
  `.env.example` e nunca versione `.env` real.
- Não armazene número de cartão, CVV ou credenciais bancárias. Use checkout
  hospedado ou tokenização do provedor.
- Nunca confie em preço, total ou frete enviados pelo navegador: recalcule no
  servidor. Confirme pagamentos por webhook autenticado e consulta ao provedor,
  sempre com idempotência.
- Para serviços ainda sem credenciais, implemente adaptadores explícitos e mocks
  somente em desenvolvimento, com aviso visível de simulação. Nunca registre
  pagamento simulado como transação real.
- Não altere produção nem execute operações destrutivas sem autorização expressa.
- No Supabase, habilite RLS, separe cliente e administrador e valide permissões
  também no backend. Operações com `SUPABASE_SECRET_KEY` são exclusivamente de
  servidor.
- No Mercado Pago, mantenha Access Token e Webhook Secret no servidor, valide a
  assinatura e consulte o pagamento no provedor. Processe webhooks com
  idempotência e nunca confie apenas no retorno visual do checkout.
- No Melhor Envio, mantenha OAuth e tokens no servidor, proteja endereços, valide
  CEP/encomendas, trate renovação e separe ambientes de teste e produção.
- O token do Instagram é privado, deve ter escopo mínimo e permanecer no servidor.
- Antes de commit ou publicação, execute a detecção de segredos no trabalho atual
  e no histórico. Se houver vazamento, revogue e rotacione; não reescreva o
  histórico nem faça force push automaticamente.
- Workflows devem usar permissões mínimas e nunca executar deploy ou publicação
  sem uma etapa futura explicitamente autorizada.

## Regra financeira central

- Existe uma única conta recebedora. O cliente paga 100% à conta comercial; o
  gateway nunca divide a cobrança entre proprietária, organizadora e artistas.
- Após despesas compartilhadas elegíveis e previamente acordadas, o lucro
  distribuível é dividido em 50% para a proprietária e 50% para a organizadora.
- A organizadora paga os artistas com a própria parcela. Esse pagamento não é
  deduzido novamente das despesas comuns.
- Antes de automatizar valores definitivos, exija configuração e validação humana
  das categorias de despesas e das regras de fechamento.

## Qualidade e entrega

- Crie migrações versionadas e testes para caminhos críticos quando essas áreas
  entrarem no escopo.
- Rode lint, typecheck, build e testes disponíveis. Explique qualquer verificação
  que não puder ser executada.
- Em cada etapa, entregue resumo, arquivos alterados, variáveis de ambiente,
  comandos de instalação e teste, resultados, limitações e passos exatos de
  validação manual.
- Documente decisões no `README.md` e confirme os critérios de aceitação antes de
  avançar para outra etapa.
