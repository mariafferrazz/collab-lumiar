# LinkedIn — seção Projetos

## Título

**COLLAB LUMIAR — Desenvolvimento Full-Stack de E-commerce**

## Descrição principal

A COLLAB LUMIAR é um e-commerce real em desenvolvimento, criado para valorizar
artistas e produtores da região de Lumiar, Nova Friburgo (RJ), por meio de uma
vitrine digital colaborativa.

Atuo no planejamento e desenvolvimento full-stack do projeto, incluindo
arquitetura da aplicação, identidade visual, experiência responsiva, componentes
reutilizáveis, modelagem PostgreSQL, migrations seguras, testes automatizados e
preparação da infraestrutura. A base utiliza Next.js, React, TypeScript,
Tailwind CSS, PostgreSQL, Drizzle ORM, Docker e Railway.

Entre os principais desafios técnicos estão a separação rigorosa entre
configurações públicas e privadas, a proteção de credenciais, a modelagem de
catálogo/estoque/logística, o controle transacional de migrations e a validação
em PostgreSQL descartável com cenários de concorrência e rollback.

Codex e outras ferramentas de IA apoiam implementação, testes, documentação e
revisão, com validação humana das decisões de produto e arquitetura.

O projeto possui páginas públicas e catálogo demonstrativo, além de schema e
migration validados. Persistência real, autenticação, carrinho, pagamentos,
frete, administração e deploy público ainda estão em desenvolvimento.

## Versão resumida

Desenvolvimento full-stack de um e-commerce colaborativo para artistas de
Lumiar (RJ), com Next.js, TypeScript, PostgreSQL, Drizzle ORM e Docker. Atuação
em arquitetura, interface responsiva, modelagem de dados, segurança de
credenciais, migrations e testes de integração. Projeto em desenvolvimento,
sem pagamentos ou operação em produção neste momento.

## Versão técnica

Aplicação Next.js 16/React 19 com TypeScript estrito e Tailwind CSS 4. Schema
PostgreSQL 18 modelado com Drizzle ORM; migration SQL versionada por checksum,
ledger próprio, advisory lock e transação. Testes locais com Node.js/TSX e 11
cenários de integração em PostgreSQL descartável via Docker Compose. Segurança
com módulos server-only, `.env` protegido, Gitleaks, pre-commit, GitHub Actions
e npm audit. Better Auth, Mercado Pago e Melhor Envio permanecem planejados.

## URL

GitHub: https://github.com/mariafferrazz/collab-lumiar

## Imagens sugeridas

1. Homepage desktop com identidade COLLAB LUMIAR.
2. Catálogo de produtos demonstrativos.
3. Página de detalhes de produto.
4. Página de artistas.
5. Homepage em viewport mobile.

Use somente as capturas presentes em `docs/portfolio/screenshots/` depois de
confirmar os direitos da marca e dos ativos visuais.
