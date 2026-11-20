# Autenticação e e-mails da COLLAB LUMIAR

## Estado atual

A fundação usa Better Auth `1.7.25`, adaptador Drizzle, PostgreSQL 18 e Next.js
App Router. As migrations `0000_collab_catalog`, `0001_collab_auth` e
`0002_collab_financial_pricing` estão registradas no ambiente local e no Railway
`collab/development`; as tabelas de autenticação pertencem à `0001`. Esta
documentação não altera banco nem variáveis da Railway.

O SDK Resend `6.38.1` está integrado por um adaptador server-only. Os templates,
URLs e fluxos são testados com transporte falso; nenhum e-mail real é enviado.
O cadastro público continua desabilitado no servidor e na interface.

Referências oficiais:

- <https://better-auth.com/docs/integrations/next>
- <https://better-auth.com/docs/authentication/email-password>
- <https://better-auth.com/docs/concepts/email>
- <https://resend.com/docs/send-with-nextjs>
- <https://resend.com/docs/dashboard/domains/introduction>
- <https://resend.com/docs/dashboard/domains/dns-records>
- <https://nextjs.org/docs/app/api-reference/functions/after>

## Modelo e autorização

| Tabela         | Responsabilidade                                                   |
| -------------- | ------------------------------------------------------------------ |
| `user`         | identidade, verificação, papel e estado administrativo             |
| `session`      | sessões com expiração, token e contexto do dispositivo             |
| `account`      | credenciais processadas pelo Better Auth e futuras contas externas |
| `verification` | tokens temporários de recuperação                                  |

`customer_addresses.user_id` referencia `user.id` com exclusão em cascata. O
cadastro público, quando futuramente liberado, recebe somente `CUSTOMER`.
`ADMIN` exige provisionamento server-side separado, auditado e autorizado.

Para acompanhar o painel no próprio computador, o procedimento em
[Pré-visualização local](local-admin-preview.md) utiliza a API server-side
`auth.api.createUser()` da versão instalada. A senha passa pelo hash oficial do
Better Auth, o e-mail é marcado como verificado apenas nesse bootstrap local
confiável e nenhuma rota pública de provisionamento é criada.

## Fluxos de autenticação

- a criação pública de contas está bloqueada por padrão com `disableSignUp`;
- login exige e-mail verificado e nunca promove permissões;
- o reenvio de confirmação tem limite de requisições e resposta neutra;
- links de confirmação são assinados pelo Better Auth, temporários e vinculados
  ao usuário; reutilizá-los após a confirmação é idempotente e não cria sessão,
  não muda o e-mail nem eleva o papel;
- recuperação responde da mesma forma para endereço existente ou inexistente;
- tokens de redefinição expirados, inválidos ou já consumidos são rejeitados;
- uma redefinição válida consome o token e revoga sessões existentes;
- rotas sensíveis usam rate limit por caminho e IP encaminhado pelo proxy;
- páginas administrativas revalidam sessão e papel no servidor.

O proxy da plataforma deve substituir `x-forwarded-for`; o servidor o utiliza
para rate limiting. Não exponha a origem Next.js diretamente a clientes que
possam forjar esse cabeçalho.

## Adaptador Resend

O contrato independente está em `src/lib/auth/email.ts`; a montagem do payload
Resend fica em `src/lib/auth/resend-email.ts`; somente
`src/lib/server/auth-email.ts` lê a chave e instancia o SDK. Componentes client
não importam esses módulos.

Os envios são registrados com `after()` do Next.js. Assim, o trabalho assíncrono
continua associado ao ciclo da requisição e ao `waitUntil` da plataforma, sem um
`void promise` sujeito a ser encerrado prematuramente. Ausência de configuração
ou falha do provedor gera apenas uma mensagem operacional fixa, sem destinatário,
token, URL ou conteúdo do e-mail. A resposta pública permanece neutra.

A aceitação de uma requisição pelo Resend não equivale a entrega. Uma etapa
futura deve validar eventos/status do provedor antes de definir métricas de
entrega; esta implementação não afirma que a mensagem chegou ao destinatário.

## Templates

Há versões HTML e texto em português para:

- `Confirme seu e-mail — COLLAB LUMIAR`;
- `Redefina sua senha — COLLAB LUMIAR`.

O HTML usa CSS inline, estrutura de tabelas, contraste vinho/creme, logotipo
tipográfico, botão, URL alternativa, expiração e aviso para ignorar pedidos não
reconhecidos. Não carrega imagens de terceiros nem inclui senhas. Nome e URL são
escapados antes da interpolação.

## Variáveis server-only

```dotenv
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
AUTH_EMAIL_PROVIDER=
AUTH_EMAIL_FROM=
RESEND_API_KEY=
AUTH_PUBLIC_SIGNUP_ENABLED=
```

- `BETTER_AUTH_URL`: origem canônica, sem caminho; HTTPS fora de loopback local;
- `AUTH_EMAIL_PROVIDER`: usar `resend` somente após a configuração real;
- `AUTH_EMAIL_FROM`: remetente autorizado no domínio verificado;
- `RESEND_API_KEY`: chave privada de escopo mínimo;
- `AUTH_PUBLIC_SIGNUP_ENABLED`: manter vazio/`false`; apenas `true`, junto de
  toda a configuração válida de e-mail, permite o cadastro.

Valores reais pertencem a `.env.local` no desenvolvimento autorizado ou ao
gerenciador seguro da hospedagem. Nenhuma dessas variáveis usa `NEXT_PUBLIC_`.

## Verificação futura do domínio no Resend

Não presumir que a loja já possui um domínio. Quando a proprietária autorizar:

1. criar/acessar a conta oficial no Resend e proteger o acesso com MFA;
2. registrar um domínio próprio ou escolher um subdomínio exclusivo de envio,
   por exemplo `mail.dominio-da-loja` somente se ele realmente existir;
3. no painel Resend, adicionar o domínio e copiar exatamente os registros DNS
   apresentados — nunca valores de outro projeto;
4. no provedor DNS, publicar os registros SPF e DKIM e quaisquer registros
   adicionais exigidos pelo painel; evitar um segundo registro SPF conflitante;
5. aguardar a verificação completa no Resend e conferir SPF/DKIM como válidos;
6. definir um remetente oficial no domínio verificado e uma chave restrita ao
   envio da aplicação;
7. configurar as variáveis apenas no ambiente de desenvolvimento autorizado;
8. testar primeiro com uma conta controlada, revisar links HTTPS, expiração,
   spam, versão texto e eventos do provedor;
9. só depois de testes de segurança e autorização específica considerar
   `AUTH_PUBLIC_SIGNUP_ENABLED=true`.

DNS, domínio, credenciais e envios reais não são alterados por esta etapa.

## Testes locais

Os testes unitários usam cliente e agendador falsos; os testes de autenticação
usam PostgreSQL 18 descartável em Docker. A cobertura inclui templates, HTML e
texto, configuração ausente, provedor indisponível, HTTPS, open redirect,
cadastro bloqueado, papel `CUSTOMER`, confirmação, reenvio, expiração/reuso,
recuperação neutra, redefinição consumível, revogação de sessão, rate limit e
negação administrativa.

Nenhuma suíte usa usuários ou banco da Railway e nenhum e-mail real é enviado.

## Pendências antes de qualquer envio real

- domínio/subdomínio oficial escolhido e autorizado;
- SPF e DKIM verificados;
- remetente oficial definido;
- chave Resend criada e armazenada com segurança;
- origem HTTPS definitiva confirmada;
- política de eventos/entrega e observabilidade definida sem dados sensíveis;
- testes controlados em `development` expressamente autorizados;
- revisão de abuso/rate limit atrás do proxy real;
- autorização separada para habilitar cadastro público.
