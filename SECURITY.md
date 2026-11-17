# Política de segurança da COLLAB

Este projeto será publicado como portfólio. Não envie credenciais, dados pessoais
ou detalhes exploráveis em issues, discussões, pull requests ou logs públicos.

## Como reportar uma vulnerabilidade

Quando o repositório estiver no GitHub, prefira o recurso **Private vulnerability
reporting**, que deverá ser habilitado nas configurações de segurança. Enquanto
ele não estiver disponível, contate a proprietária por um canal privado indicado
no perfil do repositório.

Inclua apenas o necessário para reproduzir o problema. Não compartilhe tokens,
senhas, dados de clientes ou provas de conceito que exponham terceiros. Não abra
uma issue pública antes da correção coordenada.

## Proteção de credenciais

- Use `.env.local` somente no ambiente local e nunca o versione.
- Mantenha no Git apenas `.env.example`, com nomes e valores vazios.
- Configure valores de produção no gerenciador seguro da Vercel, Railway ou da
  plataforma escolhida.
- Considere todo valor `NEXT_PUBLIC_` como informação pública, incorporada ao
  bundle do navegador durante o build.
- Mantenha Secret Keys, Access Tokens, Client Secrets e Webhook Secrets em
  módulos que importam `server-only`.
- Nunca coloque segredos em componentes com `"use client"`, `next.config.ts`,
  respostas HTTP, mensagens de erro, telemetria ou logs.
- Use credenciais distintas para desenvolvimento, homologação e produção, com
  permissões mínimas e rotação periódica.

## Procedimento em caso de vazamento

1. Considere a credencial comprometida, mesmo que o commit tenha sido apagado.
2. Revogue e rotacione a credencial imediatamente no provedor correspondente.
3. Remova o valor dos arquivos e variáveis de CI/hospedagem afetados sem copiá-lo
   para tickets, chats ou relatórios.
4. Verifique logs de acesso, webhooks, pagamentos e alterações administrativas.
5. Execute Gitleaks novamente no diretório de trabalho e em todo o histórico.
6. Se o segredo chegou ao Git, planeje a reescrita do histórico com todos os
   colaboradores. Não faça reescrita ou `push --force` sem coordenação e backup.
7. Registre a causa e adicione uma barreira que impeça recorrência.

Apagar o valor do commit mais recente não revoga a credencial e não o remove dos
commits anteriores.

## Verificações locais antes de publicar

Instale o [pre-commit](https://pre-commit.com/) e ative o hook versionado:

```bash
pre-commit install
pre-commit run --all-files
```

O hook usa Gitleaks e bloqueia o commit quando encontra um possível segredo. Para
uma auditoria completa do histórico com o executável instalado:

```bash
gitleaks git --redact --verbose .
```

Também execute:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm audit
```

Nunca adicione uma exceção do Gitleaks apenas para fazer a verificação passar.
Confirme primeiro que o resultado é comprovadamente falso e documente a decisão.

## Controles do GitHub a habilitar manualmente

- Dependency graph, Dependabot alerts e Dependabot security updates.
- Secret scanning e Push protection.
- Private vulnerability reporting.
- GitHub Actions com ações permitidas limitadas às necessárias.
- Ruleset da branch principal exigindo pull request, revisão, conversas
  resolvidas e os checks de CI, Gitleaks e Dependency Review.
- Bloqueio de exclusão e de force push na branch principal.

Os workflows deste repositório apenas validam código, dependências e possíveis
segredos. Eles não fazem deploy, publicação ou alteração de ambientes externos.

## Regras futuras por integração

- **Supabase:** habilitar RLS em todas as tabelas expostas, validar autorização
  no backend, separar perfis de cliente e administrador e manter a Secret Key
  exclusivamente no servidor.
- **Mercado Pago:** usar checkout seguro, validar a assinatura do webhook,
  consultar o pagamento no provedor, processar notificações com idempotência e
  nunca armazenar número completo de cartão ou CVV.
- **Melhor Envio:** manter OAuth no servidor, proteger endereços, validar CEP e
  encomendas, tratar expiração/renovação e separar teste de produção.
- **Instagram:** manter o token privado no servidor, com escopo mínimo e rotação.
