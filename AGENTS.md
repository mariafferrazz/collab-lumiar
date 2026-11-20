<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# COLLAB: regras permanentes do projeto

## Escopo, idioma e arquitetura

- Mantenha todo o código da loja dentro deste diretório `collab/`; não altere
  projetos irmãos em `gabi/`.
- Use Next.js App Router, TypeScript estrito, Tailwind CSS, PostgreSQL,
  Drizzle ORM e Better Auth, com versões estáveis e documentação oficial atual.
  Use Docker com PostgreSQL descartável para migrations e testes de integração.
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
  esse prefixo somente para valores realmente públicos e revisados. Toda
  credencial privada deve ter nome sem esse prefixo e permanecer no servidor.
- Módulos que acessam segredos devem importar `server-only` e usar o helper em
  `src/lib/server/env.ts`. Eles não podem ser importados por componentes client.
- Nunca exponha segredos via `next.config.ts`, props serializadas, respostas de
  API, mensagens de erro, telemetria ou logs. Nunca copie valores sensíveis para
  relatórios, issues, pull requests ou documentação.
- Valide entradas no servidor, trate erros, autorize por recurso, limite
  requisições em endpoints sensíveis e não registre dados pessoais sensíveis.
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
- No Better Auth, mantenha segredo, sessões, tokens e adaptadores exclusivamente
  no servidor. Cadastro público recebe apenas o papel `CUSTOMER`; `ADMIN` exige
  provisionamento separado e autorização explícita. Verifique sessão e permissão
  no servidor, próximo ao recurso, e nunca confie apenas no Proxy ou na interface.
- O ambiente de pré-visualização administrativa deve aceitar somente o banco
  marcado `COLLAB_LOCAL_DEVELOPMENT_DATABASE` em `127.0.0.1:55432`, PostgreSQL
  principal 18. Nunca reutilize o runner local para Railway, remova seus guards
  ou adicione uma rota web para criar `ADMIN`.
- Mantenha o cadastro público desabilitado por padrão. Ele só pode ser liberado
  depois que o provedor de e-mail, o domínio remetente, SPF/DKIM, os links HTTPS e
  os fluxos de segurança forem validados no ambiente autorizado.
- Credenciais de e-mail transacional são server-only. Nunca registre chaves,
  destinatários, tokens ou links completos de verificação/recuperação; respostas
  públicas de reenvio e recuperação devem permanecer neutras para evitar
  enumeração de contas.
- No Mercado Pago, mantenha Access Token e Webhook Secret no servidor, valide a
  assinatura e consulte o pagamento no provedor. Processe webhooks com
  idempotência e nunca confie apenas no retorno visual do checkout.
- No Melhor Envio, mantenha OAuth e tokens no servidor, proteja endereços, valide
  CEP/encomendas, trate renovação e separe ambientes de teste e produção.
- O token do Instagram é privado, deve ter escopo mínimo e permanecer no servidor.
- O catálogo público persistido deve usar somente DTOs públicos e fonte
  explicitamente selecionada. Nunca exponha custos, participações, regras de
  encargos ou auditoria, nunca misture fixtures com registros persistidos e nunca
  use fallback demonstrativo silencioso diante de falha do banco.
- `persisted-local` aceita exclusivamente o PostgreSQL local identificado em
  `127.0.0.1:55432`. Prévia de rascunho exige `ADMIN`, execução por requisição,
  `noindex` e ausência de cache público ou mutações.
- Antes de commit ou publicação, execute a detecção de segredos no trabalho atual
  e no histórico. Se houver vazamento, revogue e rotacione; não reescreva o
  histórico nem faça force push automaticamente.
- Workflows devem usar permissões mínimas e nunca executar deploy ou publicação
  sem uma etapa futura explicitamente autorizada.

## Regra financeira central

- Existe uma única conta recebedora. O cliente paga 100% à conta comercial; o
  gateway nunca divide a cobrança entre proprietária, organizadora e artistas.
- O custo do artista é o valor integral acordado que será devido após uma venda
  legitimamente concluída. Ele não é descontado das participações comerciais.
- O adicional comercial é exatamente 40% do custo do artista. Metade desse
  adicional pertence à proprietária e metade à organizadora; qualquer centavo
  indivisível permanece como resíduo auditável, sem favorecimento automático.
- Taxas de pagamento e tributos ficam fora do custo e do adicional de 40%.
  Calcule gross-up conforme a base real, vigência e escopo aprovados; nunca
  invente alíquotas nem duplique uma taxa fixa por pedido em cada item.
- Frete é separado da mercadoria e das participações. Se um encargo incidir
  sobre o total com frete, registre essa incidência sem reduzir silenciosamente
  custo ou participações.
- Previsão não equivale a venda, recebimento, saldo disponível ou repasse.
  Antes de automatizar valores definitivos, exija configuração e validação
  humana das regras comerciais, tributárias e de fechamento.

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
