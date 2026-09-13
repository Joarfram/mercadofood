# MercadoFood — Proposta de redistribuição dos planos v2

Status: PROPOSTA. Não aplicar no banco nem alterar assinaturas atuais sem aprovação final do proprietário.

## Diagnóstico atual

Hoje o salto de valor percebido entre Profissional e Premium é pequeno. No banco, o Profissional já possui praticamente todos os módulos operacionais. O Premium acrescenta principalmente estoque/ficha técnica, mais usuários e mais unidades. Isso enfraquece a justificativa comercial do plano Premium.

## Objetivo

Criar três níveis claros de valor:

- Básico = vender
- Profissional = operar
- Premium = controlar, escalar e crescer

## Proposta de matriz

| Recurso | Básico | Profissional | Premium |
|---|:---:|:---:|:---:|
| Cardápio digital | Sim | Sim | Sim |
| Produtos, categorias, fotos e complementos | Sim | Sim | Sim |
| Pedidos delivery e retirada | Sim | Sim | Sim |
| PIX manual | Sim | Sim | Sim |
| Promoções e cupons | Sim | Sim | Sim |
| Dashboard básico | Sim | Sim | Sim |
| Clientes | — | Sim | Sim |
| Caixa e pagamentos | — | Sim | Sim |
| Cozinha | — | Sim | Sim |
| Mesas e comandas | — | Sim | Sim |
| Equipe e permissões | — | Sim | Sim |
| Relatórios | Básicos | Operacionais | Avançados e comparativos |
| Gestão de entregas | Simples | Completa | Completa |
| App do entregador | — | Até 5 | Até 20 |
| Rastreamento GPS | — | Franquia intermediária | Franquia ampliada |
| Estoque simples por produto | — | Sim | Sim |
| Estoque de insumos | — | — | Sim |
| Ficha técnica | — | — | Sim |
| CMV e custo por produto | — | — | Sim |
| Margem e rentabilidade | — | — | Sim |
| Alertas inteligentes de estoque/custos | — | — | Sim |
| Multiunidade | — | — | Até 3 unidades |
| Relatórios consolidados multiunidade | — | — | Sim |
| Indicadores avançados e comparações | — | — | Sim |
| Recursos avançados de crescimento/IA | Adicional | Adicional | Prioridade/benefícios maiores |
| Usuários | 2 | 6 | 15 |

## Mudança principal recomendada

Separar o conceito de estoque em dois níveis:

1. Profissional: estoque simples de produtos acabados, com entrada, saída, alerta mínimo e baixa automática por venda.
2. Premium: estoque completo de insumos, ficha técnica, perdas, custo, CMV, margem e baixa por receita.

Isso cria valor real entre Profissional e Premium sem retirar do Profissional ferramentas essenciais de operação.

## Premium deve vender resultado, não apenas funções

O posicionamento comercial do Premium deve enfatizar:

- saber quanto cada produto realmente custa;
- reduzir desperdícios;
- controlar insumos;
- acompanhar margem;
- comparar unidades;
- identificar produtos mais rentáveis;
- tomar decisões com relatórios avançados.

## Pontos técnicos necessários antes de aplicar

- Hoje `stock` funciona como um único módulo. Para separar estoque simples de ficha técnica, o ideal é criar novas permissões, por exemplo:
  - `stock_basic`
  - `stock_advanced`
  - `recipes`
  - `costs`
- Não migrar assinantes atuais automaticamente sem regra definida.
- Garantir que downgrade não apague dados.
- Esconder menu não basta. O servidor e o banco devem validar o plano.
- Revisar `lib/billing/plans.ts`, `plan_entitlements`, navegação lateral e páginas de estoque.

## Preços atuais mantidos nesta proposta

- Básico: R$ 75/mês ou R$ 49,90/mês no anual
- Profissional: R$ 150/mês ou R$ 99,90/mês no anual
- Premium: R$ 225/mês ou R$ 149,90/mês no anual

Os preços não foram alterados nesta proposta. Primeiro deve ser aprovada a distribuição de recursos.

## Próxima decisão

Antes de implementar, confirmar se o estoque simples deve realmente entrar no Profissional. Esta é a mudança que mais melhora a diferença de valor entre Profissional e Premium sem deixar o Profissional incompleto.
