# Arquivo de estado — Gestão Delivery Simples

Data do snapshot: 29/08/2026

Este arquivo registra o estado do trabalho da Gestão Delivery Simples antes da pausa de homologação externa. O objetivo é permitir retomada sem perda de contexto ou decisões.

## Segurança do trabalho

- Branch de desenvolvimento: `feature/gestao-delivery-simples`
- Branch de backup criada: `archive/gestao-delivery-simples-2026-08-29`
- PR: #1 `feat: iniciar Gestão Delivery Simples`
- PR permanece em rascunho.
- Nenhuma migration desta feature foi aplicada no banco principal do MercadoFood.
- Nenhum merge em `main` foi feito.
- Nenhum deploy de produção foi autorizado.

## Estado técnico consolidado

A Gestão Delivery Simples foi estruturada como plano separado dos planos Básico, Profissional e Premium, mas continua dentro da mesma plataforma MercadoFood com controle por feature gating.

### Produtos e cardápio

- venda por unidade;
- venda por peso proporcional;
- pesos prontos/embalagens prontas;
- quantidade mínima e incremento em gramas para produtos por peso;
- preço de referência em g ou kg;
- cardápio público V2 com seleção de peso e cálculo proporcional;
- complementos preservados no cálculo;
- combo existente integrado, com bloqueio temporário para produto medido dentro de combo até haver seletor adequado.

### Checkout

- entrega ou retirada;
- PIX, dinheiro e cartão na entrega conforme configuração;
- cupom no fluxo V2;
- taxa de entrega/região;
- pedido público transacional;
- preço final de produto por peso calculado antes da validação comercial final;
- pedido mínimo e cupom validados sobre o subtotal final do peso;
- migration de correção final: `20260830023000_delivery_simple_final_weight_checkout.sql`.

### Estoque

- estoque físico, reservado e disponível;
- reserva de estoque ao criar pedido;
- confirmação converte reserva em baixa física;
- cancelamento libera reserva;
- expiração planejada em 30 minutos;
- rotina via `pg_cron` a cada 5 minutos criada no código;
- estoque por produto para a Gestão Delivery Simples;
- entrada, venda de balcão, perda, retorno e ajustes;
- indisponibilidade automática quando saldo disponível chega a zero;
- reativação automática somente quando a indisponibilidade foi causada pelo próprio estoque;
- pausa manual do lojista não é sobrescrita;
- alertas e reposição rápida na tela de estoque.

### Pedidos e operação

- pedido interno do atendente corrigido para processar múltiplos itens;
- reserva de estoque dentro da mesma transação do pedido interno;
- produtos por peso temporariamente escondidos do carrinho interno até existir seletor específico;
- ciclo de status com RPC atômico;
- cancelamento e estoque tratados na mesma transação;
- sequência de status protegida contra regressões indevidas.

### WhatsApp

- fila/registro de notificação;
- tentativa de envio direto pela integração existente;
- registro de falha;
- reenvio manual;
- falha do WhatsApp não invalida pedido já criado;
- ainda precisa de teste real com credenciais Meta e validação da janela de 24h/template.

### Impressão PDV

- fila de impressão;
- configuração de impressora;
- conector local Windows;
- token da impressora;
- impressão automática;
- reprocessamento após falha;
- retry com intervalo crescente;
- ainda precisa de teste real na impressora PDV/PretoPrint.

### Dashboard

- indicadores considerando estoque reservado;
- produtos com estoque baixo/zerado;
- reservas ativas;
- vendas por peso exibidas em g/kg quando aplicável;
- produtos mais vendidos tratados de forma compatível com unidades diferentes.

## Migrations importantes adicionadas

Entre as migrations da feature estão:

- `20260829164000_delivery_simples_product_selling_mode.sql`
- `20260829173000_delivery_simples_fixed_weight_options.sql`
- `20260829184500_delivery_simples_public_menu.sql`
- `20260829191000_delivery_simples_pricing_guard.sql`
- `20260829203000_delivery_simples_order_item_measurements.sql`
- `20260829214500_delivery_simples_product_stock_ledger.sql`
- `20260829221000_delivery_simples_apply_stock.sql`
- `20260829232000_delivery_simples_finalize_order.sql`
- `20260829233500_delivery_simples_stock_pack_quantity.sql`
- `20260829235000_delivery_simples_preserve_addons.sql`
- `20260829235500_delivery_simples_order_outputs.sql`
- `20260830000500_delivery_simples_stock_reservations.sql`
- `20260830001000_delivery_simples_secure_outputs_and_connector.sql`
- `20260830001200_delivery_simples_reservation_expiry.sql`
- `20260830004500_delivery_simples_reservation_expiry_fix.sql`
- `20260830010000_delivery_simples_payment_stock_guards.sql`
- `20260830010100_delivery_simple_print_retry_hardening.sql`
- `20260830011000_delivery_simples_atomic_public_order.sql`
- `20260830011500_delivery_simples_atomic_checkout_guard.sql`
- `20260830012000_delivery_simples_checkout_guard.sql`
- `20260830013100_delivery_simples_weight_grams_semantics.sql`
- `20260830013200_delivery_simples_coupon_reprice.sql`
- `20260830013300_delivery_simple_reconcile_totals.sql`
- `20260830014500_delivery_simples_combo_stock_guard.sql`
- `20260830015000_delivery_simples_atomic_order_status.sql`
- `20260830016000_delivery_simple_reservation_cron.sql`
- `20260830020000_delivery_simple_staff_order_stock.sql`
- `20260830021000_delivery_simple_product_stock_operations.sql`
- `20260830022000_delivery_simple_stock_availability_sync.sql`
- `20260830023000_delivery_simple_final_weight_checkout.sql`

## Homologação

Checklist principal: `docs/HOMOLOGACAO_GESTAO_DELIVERY_SIMPLES.md`.

Antes de produção ainda é obrigatório:

1. aplicar o conjunto de migrations em ambiente Supabase separado de homologação;
2. validar SQL real e dependências de extensões/constraints;
3. confirmar disponibilidade do `pg_cron` no ambiente alvo;
4. testar unidade, peso e peso pronto;
5. testar pedido mínimo e cupom com peso final;
6. testar concorrência de estoque, expiração e cancelamento;
7. testar WhatsApp real;
8. testar impressão real na PDV;
9. revisar CI final;
10. somente depois obter autorização explícita para produção.

## Situação do Supabase

Foi tentada a criação de uma branch de homologação no Supabase do projeto principal, mas o recurso Branching exige plano Pro ou superior. Nenhuma branch Supabase foi criada e nenhum custo foi gerado.

O caminho sugerido para a retomada é criar um projeto Supabase separado apenas para homologação, caso o usuário aprove o custo correspondente.

## Regra para retomada

Ao retomar este trabalho, usar primeiro a branch `feature/gestao-delivery-simples`. A branch `archive/gestao-delivery-simples-2026-08-29` deve ser tratada como cópia de segurança do estado atual e não como branch de desenvolvimento.
