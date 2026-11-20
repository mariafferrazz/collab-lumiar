# Modelo financeiro da COLLAB LUMIAR

## Estado e limites

O módulo implementa formação de preço, configuração versionada e auditoria
administrativa. Ele não processa pagamentos, não calcula tributos oficiais, não
contrata frete, não registra vendas e não transfere valores. A migration
`0002_collab_financial_pricing` foi testada em PostgreSQL 18 descartável e
aplicada de forma controlada na Railway `development` em 19 de novembro de
2026, depois de rotação preventiva da credencial, novo backup, restauração,
ensaio em clone e autorização explícita. Ela também está aplicada no PostgreSQL
persistente da pré-visualização local, que permanece isolado da Railway.

## Regra comercial

Todos os cálculos monetários usam centavos inteiros.

```text
custo do artista = valor integral acordado
adicional comercial = arredondar(custo × 40%)
parcela da proprietária = piso(adicional ÷ 2)
parcela da organizadora = piso(adicional ÷ 2)
resíduo = adicional - proprietária - organizadora
preço comercial base = custo + adicional
```

O adicional é **40% do custo do artista**; ele não corresponde a 40% do preço de
venda. Um custo de R$ 100,00 produz adicional de R$ 40,00, base comercial de
R$ 140,00 e parcelas de R$ 20,00 para cada parte.

Um centavo que não puder ser dividido permanece em
`rounding_residual_in_cents`. Ele não é atribuído automaticamente a nenhuma das
partes. Custo, adicional, parcelas e resíduo sempre reconciliam exatamente.

## Encargos e gross-up

Taxas de pagamento e tributos ficam fora do custo e do adicional. Cada regra
versionada registra tipo, modalidade, percentual em basis points, valor fixo,
base de incidência, escopo, vigência, fonte, aprovador e data de aprovação.

Para regras lineares, o motor resolve o preço final sem ponto flutuante:

```text
P = (base × 10.000 + fixos × 10.000 + incidências fora de P)
    ÷ (10.000 - alíquotas incidentes sobre P)
```

A divisão usa teto para não subprovisionar encargos. Cada encargo é arredondado
por half-up e a diferença final fica registrada como resíduo de cálculo. Bases
distintas são tratadas separadamente; o cálculo é recusado se o denominador for
nulo ou negativo.

Uma taxa `per_order` nunca é usada na precificação unitária. No cálculo futuro
de pedido, o valor fixo é aplicado uma única vez, mesmo com vários itens. A
implementação atual aceita um parâmetro de pagamento e um tributário por cenário
de produto; múltiplos tributos simultâneos exigem evolução versionada.

Essa limitação não impede a evolução do domínio: `financial_charge_rules` já
registra cada regra, base, escopo, vigência e fonte separadamente. Uma migration
futura deverá normalizar a associação cenário-regra em uma tabela N:N e criar
snapshots por item/pedido, preservando os cenários já registrados. A `0002` não
antecipa apuração fiscal, documento fiscal ou taxas enquanto CNPJ, regime,
CNAE e natureza da operação não forem confirmados profissionalmente.

## Frete

```text
total do pedido = mercadorias + frete cobrado
```

Frete não integra custo, adicional ou participações. O motor aceita frete como
base apenas para encargos que comprovadamente incidam sobre ele. Cotação, valor
cobrado, etiqueta e diferença logística dependerão do futuro módulo de pedidos
e da API oficial do Melhor Envio.

## Banco de dados

| Tabela                       | Responsabilidade                                    |
| ---------------------------- | --------------------------------------------------- |
| `financial_pricing_policies` | acordo 40%/50%/50%, versão, vigência e aprovação    |
| `financial_charge_rules`     | parâmetros de taxa/tributo, base, escopo e vigência |
| `product_financial_costs`    | custo por produto ou variação e divisão comercial   |
| `product_pricing_scenarios`  | modalidade, encargos previstos e preço calculado    |
| `financial_audit_events`     | trilha append-only das ações financeiras            |

Políticas e regras aprovadas são imutáveis. Cenários validados e custos ligados
a eles também são imutáveis. Correções exigem nova versão. O banco impede
publicação consistente sem cenário padrão validado e coerente com o preço do
produto. Uma variação com custo próprio exige cenário coerente com seu preço.
Uma variação ativa com preço específico também é bloqueada se não tiver custo e
cenário financeiro validados. O banco recalcula a decomposição fixa de 40% e
50%/50% em centavos e rejeita valores apenas aparentemente reconciliados.

O trigger de validação exige política e regras aprovadas e vigentes, modalidade
de pagamento correspondente e escopo por item. A auditoria aceita inserções
legítimas, mas rejeita qualquer `UPDATE` ou `DELETE`.

## Fluxo administrativo

1. um `ADMIN` registra política, fonte e vigência;
2. condições confirmadas do Mercado Pago e da contabilidade são cadastradas;
3. a aprovação explícita torna cada configuração imutável;
4. registra-se o custo do produto ou variação;
5. o servidor calcula o cenário, nunca o navegador;
6. o cenário fica `pending_validation`;
7. uma ação separada valida e sincroniza o preço do catálogo;
8. a auditoria registra ator, entidade, ação e metadados não sensíveis.

Sem política, taxa ou tributo aprovados, o custo pode ser salvo, mas o preço
definitivo continua incompleto e não atende à publicação financeira.

## Repasses, snapshots e conciliação futura

O custo representa o valor potencialmente devido ao artista, mas só se torna
elegível após uma política aprovada de conclusão da venda. Pagamento aprovado
não é automaticamente venda concluída.

Pedidos futuros deverão criar snapshots imutáveis de produto, variação, artista,
custo, política, parcelas, encargos, quantidade, desconto, frete e condição de
pagamento. Eventos de provedor exigirão chave idempotente. Repasses precisarão
referenciar pedido/itens, elegibilidade, responsável e comprovante, sem
transferências automáticas.

Conciliação deverá comparar valor cobrado, aprovado, líquido recebido, taxas
previstas/efetivas, tributos provisionados/apurados, frete e ajustes. Divergências
nunca reduzem silenciosamente custo ou participações.

## Validações pendentes

- enquadramento jurídico e tributário da entidade vendedora;
- alíquotas, bases, documento fiscal e tratamento do frete por contador;
- condições e vigências reais da conta Mercado Pago;
- política de conclusão, cancelamento, devolução e elegibilidade de repasse;
- composição futura de múltiplos tributos e alocação de custos comuns;
- parametrização profissional das regras antes de qualquer operação comercial;
- criação futura de snapshots de pedido e associação de múltiplos tributos.

Este módulo não substitui contabilidade ou orientação jurídica profissional.
