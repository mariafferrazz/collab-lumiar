# LinkedIn — atualização do projeto para revisão

Texto preparado para publicação manual. A aplicação continua em desenvolvimento
e não está disponível para compras.

## Versão principal

Estou avançando no desenvolvimento da **COLLAB LUMIAR**, um e-commerce em
construção para valorizar artistas e produtores da região de Lumiar, em Nova
Friburgo (RJ).

Desde a primeira publicação do projeto, a base evoluiu de uma interface pública
para uma aplicação full-stack com autenticação, painel administrativo e catálogo
persistido. Hoje o ambiente local já permite gerenciar artistas, categorias,
produtos, variações, estoque, logística e precificação, além de visualizar
rascunhos com acesso privado antes da publicação na vitrine.

Entre os principais desafios de engenharia desta fase estiveram:

- modelar e versionar migrations PostgreSQL com checksum, transação, advisory
  lock e ledger próprio;
- integrar Better Auth com papéis `CUSTOMER` e `ADMIN`, verificação de e-mail e
  sessões protegidas;
- manter dados administrativos e financeiros fora dos contratos públicos;
- conectar a vitrine ao catálogo persistido sem misturar dados demonstrativos;
- testar migrations, concorrência, rollback e autenticação em PostgreSQL 18
  descartável no Docker;
- reconciliar com segurança um banco local divergente, preservando backup e
  rollback sem editar o histórico de migrations.

O projeto utiliza Next.js 16, React 19, TypeScript, Tailwind CSS, PostgreSQL 18,
Drizzle ORM, Better Auth, Docker e GitHub Actions. Gitleaks, npm audit, testes
automatizados e guards de ambiente fazem parte do fluxo de desenvolvimento.

Codex e outras ferramentas de IA apoiam implementação, revisão e documentação.
As decisões de arquitetura, os testes e a aprovação de mudanças permanecem sob
validação humana.

A loja ainda não está em produção: não recebe pagamentos, não contrata frete,
não envia e-mails reais e ainda não possui o inventário definitivo nem upload
remoto de imagens. A próxima etapa técnica será o sistema de imagens do catálogo.

GitHub: https://github.com/mariafferrazz/collab-lumiar

#EngenhariaDeSoftware #DesenvolvimentoFullStack #Nextjs #TypeScript #PostgreSQL

## Versão resumida

A **COLLAB LUMIAR** evoluiu para uma aplicação full-stack com Next.js,
TypeScript e PostgreSQL: autenticação com Better Auth, painel administrativo,
gestão de catálogo e estoque, precificação, prévia privada de rascunhos e vitrine
integrada ao banco local.

A engenharia inclui migrations transacionais com checksum e ledger, testes em
PostgreSQL 18 descartável, proteção de dados privados, CI e secret scanning. IA
é usada como apoio, sempre com revisão e validação humana.

O projeto continua em desenvolvimento e ainda não processa vendas, pagamentos,
frete ou e-mails reais.

GitHub: https://github.com/mariafferrazz/collab-lumiar

#FullStack #Nextjs #PostgreSQL #Docker #DevSecOps

## Imagens sugeridas

1. Home atual, identificada como demonstração.
2. Listagem pública do catálogo demonstrativo.
3. Dashboard administrativo vazio ou apenas com dados de desenvolvimento.
4. Painel financeiro sem valores comerciais confidenciais.

As capturas administrativas precisam de revisão da proprietária antes da
publicação. Não mostrar e-mail, cookie, token, credencial ou dados reais.
