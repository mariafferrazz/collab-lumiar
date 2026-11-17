# Publicação no GitHub

Este documento registra a publicação autorizada do projeto como portfólio
profissional.

## Repositório

- **Nome:** `collab-lumiar`
- **URL:** https://github.com/mariafferrazz/collab-lumiar
- **Visibilidade:** pública
- **Descrição:** E-commerce colaborativo de artistas regionais, desenvolvido
  com Next.js, TypeScript e PostgreSQL.
- **Branch principal:** `main`

## Topics sugeridos

```text
nextjs
typescript
react
postgresql
drizzle-orm
ecommerce
docker
railway
fullstack
portfolio
```

Os topics descrevem tecnologias e escopo já presentes. Eles não afirmam que
pagamentos, autenticação ou frete estejam concluídos.

## Mensagem do primeiro commit público

```text
feat: preparar COLLAB Lumiar para portfólio público
```

## Checklist da publicação

- [x] Confirmar autorização para publicar marca, logo, fotografias e conteúdo
- [x] Revisar todos os arquivos não rastreados e alterações existentes
- [x] Confirmar `.env.local` ignorado e ausente do staging
- [x] Executar Gitleaks no diretório atual, histórico e staging
- [x] Executar lint, typecheck, testes, build, npm audit e integração Docker
- [x] Revisar screenshots e remover qualquer ativo sem autorização
- [x] Revisar README, direitos de uso e textos do LinkedIn
- [x] Obter aprovação explícita para criar commit e repositório remoto

## Sequência executada após autorização

1. Adicionar cuidadosamente somente os arquivos revisados ao staging.
2. Executar novamente Gitleaks no staging.
3. Criar o commit com a mensagem aprovada.
4. Criar o repositório `collab-lumiar` sem sobrescrever outro projeto.
5. Configurar `origin` e fazer o primeiro push da branch `main`.
6. Confirmar a URL pública e substituir os marcadores nos textos do LinkedIn.
7. Fixar o projeto no perfil GitHub, se desejado.

## Controles do GitHub após a publicação

- Secret Scanning e Push Protection;
- Dependency Graph, Dependabot alerts e security updates;
- Private Vulnerability Reporting;
- ruleset da `main` exigindo pull request e checks de CI;
- bloqueio de force push e exclusão da branch principal;
- permissões mínimas para GitHub Actions.

## Estado da publicação

- GitHub CLI autenticado na conta `mariafferrazz`;
- repositório público criado sem substituir outro projeto;
- remote `origin` configurado para o repositório correto;
- branch principal local `main`;
- README e materiais visuais incluídos no conjunto auditado;
- nenhum deploy, migration, acesso à produção ou publicação no LinkedIn.
