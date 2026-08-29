# Homologação técnica — Gestão Delivery Simples

Este documento é o checklist de liberação da Gestão Delivery Simples. Ele separa o que já está implementado do que ainda precisa ser validado em um Supabase de teste e em hardware real.

## Estado atual

- Branch: `feature/gestao-delivery-simples`
- O código web passou no CI da Vercel até o commit anterior ao ajuste final de peso/cupom.
- As migrations desta branch ainda não foram aplicadas no banco de produção.
- A branch está à frente de `main` e não está atrás dela.
- A PR permanece em rascunho até o fim da homologação.

## Fluxo 1 — cadastro e estoque do produto

Validar em ambiente de teste:

1. Criar produto por unidade com estoque controlado.
2. Criar produto por peso com preço de referência, mínimo e incremento.
3. Criar produto com pesos prontos.
4. Registrar entrada de mercadoria.
5. Registrar venda de balcão.
6. Registrar perda, retorno e ajustes.
7. Confirmar que uma saída nunca consome quantidade já reservada para pedido online.
8. Confirmar que saldo disponível zero marca o produto como indisponível automaticamente.
9. Confirmar que uma nova entrada reativa apenas produto desativado automaticamente pelo estoque, sem sobrescrever pausa manual do lojista.

## Fluxo 2 — cardápio e pedido público

Validar:

1. Produto por unidade no cardápio.
2. Produto por peso com seleção de quantidade em gramas e cálculo proporcional.
3. Produto com peso pronto.
4. Complementos obrigatórios e opcionais.
5. Combo com itens por unidade.
6. Bloqueio de produto por peso dentro de combo enquanto não existir seletor próprio no construtor de combos.
7. Carrinho, retirada e entrega.
8. Endereço e região de entrega.
9. PIX, dinheiro e cartão na entrega.
10. Cupom com e sem pedido mínimo.
11. Pedido mínimo da loja e da região de entrega.

### Correção aplicada — preço final antes de pedido mínimo/cupom

O bloqueador de validação antecipada foi corrigido no código da branch. O RPC `delivery_simple_create_public_order_atomic` agora usa o criador legado apenas para montar cliente, complementos e estrutura do pedido em modo neutro, sem cupom e sem validar delivery pelo subtotal-base. Depois disso, o fluxo finaliza o preço real de unidade/peso/peso pronto, aplica taxa de entrega e só então valida/aplica cupom e pedido mínimo.

Essa correção ainda precisa ser exercitada em Supabase de homologação antes de ser considerada aprovada.

Cenários obrigatórios:

1. Produto de R$ 24/kg, compra de 500 g: subtotal final de R$ 12 deve ser usado para cupom e pedido mínimo, não R$ 24.
2. Produto de R$ 24/kg, compra de 2 kg: subtotal final de R$ 48 deve ser usado, mesmo que o preço de referência seja R$ 24.
3. Pedido cujo preço-base parecer abaixo do mínimo, mas cujo peso final ultrapasse o mínimo, deve ser aceito.
4. Pedido cujo preço-base parecer suficiente, mas cujo peso final fique abaixo do mínimo, deve ser recusado.
5. `usage_limit`, `per_customer_limit`, período, `minimum_order_value` e `maximum_discount` do cupom devem continuar sendo respeitados.

## Fluxo 3 — reserva e ciclo do estoque

Validar:

1. Ao enviar pedido, criar reserva de estoque por 30 minutos.
2. O saldo disponível deve ser `físico - reservado`.
3. Confirmação de pagamento converte reserva em baixa física.
4. Pedido em dinheiro confirma estoque no ponto operacional definido.
5. Cancelamento libera reserva na mesma transação que altera o status.
6. Expiração libera reservas abandonadas.
7. A rotina `pg_cron` deve executar a cada 5 minutos em ambiente de teste.
8. Confirmar que `pg_cron` está habilitado no projeto Supabase alvo antes da aplicação em produção.

## Fluxo 4 — status do pedido

Validar sequência permitida:

`Novo → Aceito → Em preparo → Pronto → Em entrega → Entregue`

Também validar:

- cancelamento em estados permitidos;
- pedido cancelado não volta ao fluxo;
- pedido entregue não regride;
- timestamps de cada etapa;
- estoque e status permanecem consistentes se ocorrer erro no meio da operação.

## Fluxo 5 — WhatsApp

Validar com credenciais reais de teste:

1. Notificação de novo pedido.
2. Conteúdo com número, cliente, telefone, itens, peso, subtotal, taxa, total, tipo de atendimento e pagamento.
3. Registro de sucesso/falha.
4. Reenvio manual.
5. Comportamento fora da janela de 24 horas da Meta; se necessário, aprovar template para aviso iniciado pela empresa.

A falha do WhatsApp não deve invalidar um pedido já criado corretamente.

## Fluxo 6 — impressão PDV

Validar em Windows com a impressora real:

1. Download/configuração do conector local.
2. Token da impressora.
3. Impressão automática de novo pedido.
4. Número de cópias.
5. Endereço, cliente, itens, peso, observações, total e pagamento.
6. Reprocessamento após falha.
7. Impressora desligada não pode invalidar o pedido.
8. Confirmar política de tentativas e intervalo exponencial.

## Fluxo 7 — painel e operação

Validar:

- Dashboard com estoque físico, reservado e disponível.
- Alertas de estoque baixo e zerado.
- Reposição rápida na tela de estoque.
- Histórico de movimentações.
- Pedido interno do atendente/caixa com carrinho completo e reserva.
- Produto por peso permanece bloqueado no carrinho interno até existir seletor de peso específico.

## Gates antes de produção

A liberação para produção só deve ocorrer quando todos os itens abaixo estiverem satisfeitos:

- [x] Corrigir no código a validação antecipada de pedido mínimo/cupom para produtos por peso.
- [ ] Validar essa correção executando as migrations e os cenários críticos em Supabase de homologação.
- [ ] Aplicar todas as migrations, em ordem, em um projeto Supabase de homologação vazio ou restaurado para teste.
- [ ] Confirmar que nenhuma migration falha por coluna, constraint, extensão ou função inexistente.
- [ ] Confirmar `pg_cron` no ambiente alvo.
- [ ] Testar pedido completo por unidade.
- [ ] Testar pedido completo por peso.
- [ ] Testar peso pronto.
- [ ] Testar falta de estoque e concorrência de dois pedidos.
- [ ] Testar cancelamento e expiração.
- [ ] Testar cupom e pedido mínimo sobre subtotal final.
- [ ] Testar impressão na PretoPrint/PDV real.
- [ ] Testar WhatsApp real.
- [ ] Confirmar CI da Vercel no commit final.
- [ ] Revisar a PR e só então marcar como pronta.
- [ ] Obter autorização explícita antes de aplicar migrations em produção, mesclar em `main` ou fazer deploy de produção.
