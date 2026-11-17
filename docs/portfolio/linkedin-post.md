# LinkedIn — publicações prontas para revisão

Texto atualizado com a URL pública autorizada do GitHub. Revise antes de
publicar manualmente.

## Versão principal

Estou desenvolvendo a **COLLAB LUMIAR**, um e-commerce real em construção para
valorizar artistas e produtores da região de Lumiar, em Nova Friburgo (RJ).

Meu trabalho envolve o planejamento da arquitetura, a implementação da
experiência visual, a modelagem do banco de dados e a criação de uma base segura
para as próximas etapas do produto. A aplicação utiliza Next.js, React,
TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Docker e Railway.

Um dos pontos mais interessantes do projeto tem sido tratar desde cedo questões
que muitas vezes aparecem apenas perto da produção: proteção de credenciais,
separação entre código público e privado, migrations transacionais, controle de
concorrência e testes em um PostgreSQL realmente descartável.

Também trabalhei na identidade visual e na experiência responsiva da loja, no
catálogo demonstrativo, nas páginas de artistas e na preparação segura da API
oficial do Instagram. A migration inicial passou por testes de integridade,
rollback, interrupção e concorrência no Docker.

Tenho usado o Codex e outras ferramentas de IA como apoio para acelerar
implementação, revisão e documentação. O uso é acompanhado de validação humana,
testes e revisão das decisões de arquitetura — IA entra como ferramenta de
engenharia, não como substituta do processo crítico.

Até aqui, o projeto já possui interface pública, componentes reutilizáveis,
schema PostgreSQL, migration versionada, testes automatizados e proteções de
segurança. Os próximos passos são persistência real do catálogo, autenticação,
carrinho, pagamentos com Mercado Pago e integração logística com o Melhor Envio.

O projeto ainda não está em produção e não processa vendas ou pagamentos.

GitHub: https://github.com/mariafferrazz/collab-lumiar

#Nextjs #TypeScript #PostgreSQL #Docker #DesenvolvimentoFullStack

## Versão alternativa — foco técnico e recrutadores

Estou construindo a **COLLAB LUMIAR**, um e-commerce full-stack para artistas e
produtores regionais de Lumiar (RJ).

O projeto combina Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL
18, Drizzle ORM, Postgres.js, Docker Compose e Railway. Minha atuação inclui
arquitetura, interface responsiva, modelagem relacional, segurança de segredos,
migrations e testes automatizados.

Alguns desafios já trabalhados:

- schema de catálogo, estoque, imagens e logística com regras de integridade;
- migration versionada por SHA-256, executada com advisory lock e transação;
- 11 cenários de integração em PostgreSQL descartável, incluindo concorrência e
  rollback;
- isolamento de credenciais server-side e varredura com Gitleaks;
- preparação da API oficial do Instagram sem scraping nem tokens no cliente;
- diagnóstico de conectividade Docker Desktop/WSL 2 no Windows.

Codex e IA fazem parte do meu fluxo como ferramentas de apoio à implementação,
testes e revisão. Cada resultado passa por validações reproduzíveis e decisões
humanas de arquitetura.

Autenticação, catálogo persistente, carrinho, pagamentos e frete são as próximas
etapas; a aplicação ainda não está em produção.

GitHub: https://github.com/mariafferrazz/collab-lumiar

#EngenhariaDeSoftware #Nextjs #TypeScript #PostgreSQL #Docker
