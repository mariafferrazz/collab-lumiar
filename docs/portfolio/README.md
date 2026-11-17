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
visual, experiência responsiva, arquitetura server-side, modelagem relacional,
migrations seguras, testes com PostgreSQL descartável e proteção de credenciais.

O material sempre diferencia três estados:

- **implementado:** disponível e validado no código atual;
- **preparado:** existe estrutura técnica, mas depende de autorização ou etapa
  operacional;
- **planejado:** ainda não implementado.

## Arquitetura resumida

| Camada               | Estado                 | Responsabilidade                                   |
| -------------------- | ---------------------- | -------------------------------------------------- |
| Next.js/React        | Implementado           | páginas públicas, componentes e renderização       |
| Serviços server-only | Implementado/preparado | ambiente, banco e Instagram                        |
| PostgreSQL/Drizzle   | Preparado e testado    | schema e migration ainda não aplicados remotamente |
| Docker               | Implementado           | validação destrutiva em banco descartável          |
| Railway development  | Preparado              | PostgreSQL online, sem migration aplicada          |
| Better Auth          | Planejado              | autenticação e sessões                             |
| Mercado Pago         | Planejado              | pagamentos e webhooks                              |
| Melhor Envio         | Planejado              | cotação e contratação de frete                     |

## Checklist de publicação do portfólio

- [x] README distingue funcionalidades atuais e futuras
- [x] Gitleaks configurado no pre-commit e na CI
- [x] `.env.example` sem valores reais
- [x] screenshots capturadas localmente
- [x] documentação para LinkedIn preparada
- [ ] autorização para publicar marca, logotipo e imagens confirmada
- [ ] conjunto staged revisado e escaneado
- [ ] relatório final aprovado pela responsável
- [ ] repositório remoto criado e primeiro push autorizado
- [ ] URL pública adicionada aos textos do LinkedIn

## Direitos

O código público não implica licença para reutilização da marca, logotipo,
identidade visual, fotografias ou conteúdo de artistas. Nenhum desses materiais
deve ser republicado fora do portfólio sem autorização dos titulares.
