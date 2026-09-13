# MercadoFood — Matriz recomendada de planos v2

Status: RECOMENDAÇÃO FINAL PARA APROVAÇÃO COMERCIAL. Não altera assinaturas nem permissões no banco.

## Diagnóstico baseado no sistema atual

O código atual já separa os módulos principais em `dashboard`, `orders`, `products`, `kitchen`, `delivery`, `drivers`, `payments`, `finance`, `reports`, `stock`, `customers`, `promotions`, `marketing`, `messages`, `tables`, `settings` e `team`.

Hoje o plano Profissional já possui praticamente todos os módulos operacionais. O Premium acrescenta principalmente `stock`, mais usuários e mais unidades. Por isso a diferença percebida entre Profissional e Premium ainda é pequena.

A recomendação é separar o estoque em níveis, sem retirar do Profissional o que ele precisa para operar bem.

## Posicionamento comercial

- Básico — VENDER: colocar o negócio online e receber pedidos.
- Profissional — OPERAR: organizar atendimento, equipe, cozinha, caixa e entregas.
- Premium — CONTROLAR E CRESCER: controlar custos, insumos, margem, unidades e decisões de gestão.

## Matriz recomendada

| Recurso | Básico | Profissional | Premium |
|---|:---:|:---:|:---:|
| Cardápio digital e QR Code | Sim | Sim | Sim |
| Produtos, categorias, fotos, combos e complementos | Sim | Sim | Sim |
| Pedidos delivery e retirada | Sim | Sim | Sim |
| PIX manual | Sim | Sim | Sim |
| Promoções e cupons | Sim | Sim | Sim |
| Mensagens e avaliações | Sim | Sim | Sim |
| Dashboard | Essencial | Operacional | Avançado/comparativo |
| Clientes e fidelidade | — | Sim | Sim |
| Caixa e pagamentos | — | Sim | Sim |
| Cozinha | — | Sim | Sim |
| Mesas e comandas | — | Sim | Sim |
| Equipe e permissões | — | Sim | Sim |
| Relatórios | Essenciais | Operacionais | Avançados e comparativos |
| Gestão de entregas | Simples | Completa | Completa |
| App do entregador | — | Até 5 motoboys | Até 20 motoboys |
| Rastreamento GPS | — | Franquia intermediária | Franquia ampliada |
| Estoque simples de produto acabado | — | Sim | Sim |
| Entrada/saída e estoque mínimo de produto | — | Sim | Sim |
| Baixa automática do produto vendido | — | Sim | Sim |
| Estoque de insumos | — | — | Sim |
| Ficha técnica/receita | — | — | Sim |
| Baixa de insumos por receita | — | — | Sim |
| Perdas e desperdícios de insumos | — | — | Sim |
| Custo por produto | — | — | Sim |
| CMV | — | — | Sim |
| Margem e rentabilidade | — | — | Sim |
| Alertas avançados de custos/insumos | — | — | Sim |
| Multiunidade | — | — | Até 3 unidades |
| Indicadores consolidados por unidade | — | — | Sim |
| Comparação entre unidades | — | — | Sim |
| Recursos de IA/Impulsiona | Adicional | Adicional | Benefícios/franquia maior ou prioridade |
| Usuários incluídos | 2 | 6 | 15 |

## O que muda em relação ao sistema atual

### Básico

Mantém foco em venda. Não deve receber cozinha, caixa completo, clientes avançados, equipe, mesas nem estoque.

### Profissional

Continua com toda a operação atual e passa a ter estoque simples de produto acabado. Exemplo: refrigerante, lata, garrafa, produto unitário ou item vendido diretamente por quantidade.

O Profissional não recebe ficha técnica, insumos, CMV ou margem avançada.

### Premium

Continua com tudo do Profissional e passa a ser o plano de gestão de custos e expansão. Seu diferencial principal deixa de ser apenas “ter ficha técnica” e passa a ser um conjunto: insumos + ficha técnica + CMV + margem + perdas + multiunidade + relatórios avançados.

## Regra técnica recomendada

O módulo único `stock` não é suficiente para representar essa nova divisão. A implementação deve criar permissões separadas, sugeridas abaixo:

- `stock_basic`: estoque de produto acabado e baixa por unidade.
- `stock_advanced`: estoque de insumos, entradas, perdas e controles avançados.
- `recipes`: ficha técnica/receitas e consumo de insumos.
- `costs`: CMV, custo, margem e rentabilidade.
- `multiunit_reports`: consolidação e comparação entre unidades.

O servidor e o banco devem validar essas permissões. Não basta esconder o item no menu.

## Preços mantidos para a primeira fase

| Plano | Mensal | Anual, valor mensal equivalente |
|---|---:|---:|
| Básico | R$ 75,00 | R$ 49,90 |
| Profissional | R$ 150,00 | R$ 99,90 |
| Premium | R$ 225,00 | R$ 149,90 |

Primeiro deve ser validada a nova distribuição de recursos. A revisão de preços pode ser feita em uma etapa comercial separada.

## Regras de migração

1. Não retirar dados de clientes atuais.
2. Downgrade bloqueia novas operações do recurso, mas não apaga histórico.
3. Upgrade libera o recurso imediatamente.
4. Empresas piloto não devem perder acesso sem decisão explícita do administrador.
5. Alterações devem ser aplicadas primeiro em ambiente de teste e depois em produção.
6. O MercadoMaster deve continuar podendo conceder ou retirar módulos por empresa através de override administrativo.

## Próxima etapa técnica após aprovação

1. Criar os novos ModuleKeys.
2. Atualizar `lib/billing/plans.ts`.
3. Atualizar `plan_entitlements` no banco.
4. Separar a tela de estoque em estoque simples e gestão avançada/ficha técnica.
5. Atualizar sidebar e proteção de rotas.
6. Testar Básico, Profissional e Premium com usuários reais de teste.
7. Só depois migrar assinaturas existentes.