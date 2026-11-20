# Portfólio — COLLAB LUMIAR

Esta pasta reúne materiais para apresentar tecnicamente a COLLAB LUMIAR no
GitHub e no LinkedIn. O projeto é um e-commerce real em desenvolvimento para
artistas e produtores de Lumiar, Nova Friburgo (RJ).

## Materiais

- [Projeto para a seção Projetos do LinkedIn](linkedin-project.md)
- [Publicações prontas para revisão](linkedin-post.md)
- [Competências e evidências](skills.md)
- [Screenshots reais da aplicação](screenshots/README.md)
- [Plano de publicação no GitHub](github-publication.md)
- [Estratégia de banco e migrations](../database-migrations.md)

## Mensagem central

A COLLAB demonstra trabalho full-stack em um contexto comercial real: identidade
visual, experiência responsiva, autenticação, painel administrativo, catálogo
persistido, precificação, modelagem relacional, migrations seguras, testes com
PostgreSQL descartável e proteção de credenciais.

O material sempre diferencia três estados:

- **implementado:** disponível e validado no código atual;
- **preparado:** existe estrutura técnica, mas depende de autorização ou etapa
  operacional;
- **planejado:** ainda não implementado.

## Arquitetura resumida

| Camada               | Estado                  | Responsabilidade                                       |
| -------------------- | ----------------------- | ------------------------------------------------------ |
| Next.js/React        | Implementado            | vitrine, painel, formulários e renderização            |
| Serviços server-only | Implementado/preparado  | banco, autenticação, catálogo e integrações privadas   |
| PostgreSQL/Drizzle   | Implementado            | migrations 0000–0002, ledger e constraints             |
| Docker               | Implementado            | banco local persistente e testes descartáveis          |
| Railway development  | Implementado controlado | migrations aplicadas; aplicação local não usa Railway  |
| Better Auth          | Implementado localmente | sessões, papéis, verificação e recuperação             |
| Resend/Instagram     | Preparado               | adaptadores prontos; credenciais/autorização pendentes |
| Mercado Pago/Frete   | Pendente                | pagamentos, webhooks, cotação e contratação            |

## Checklist desta atualização do portfólio

- [x] README distingue funcionalidades atuais e futuras
- [x] Gitleaks configurado no pre-commit e na CI
- [x] `.env.example` sem valores reais
- [x] screenshots capturadas localmente
- [x] documentação para LinkedIn preparada
- [x] autorização anterior para publicar marca, logotipo e imagens confirmada
- [x] repositório público existente e URL aplicada aos textos
- [ ] conjunto desta atualização revisado, staged e escaneado
- [ ] novas capturas administrativas aprovadas pela proprietária
- [ ] commits e push desta atualização autorizados explicitamente

## Direitos

O código público não implica licença para reutilização da marca, logotipo,
identidade visual, fotografias ou conteúdo de artistas. Nenhum desses materiais
deve ser republicado fora do portfólio sem autorização dos titulares.
