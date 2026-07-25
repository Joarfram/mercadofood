# MercadoFood v1.1 — Pagamentos do pedido

## Incluído
- Forma de pagamento no cadastro do pedido.
- PIX, dinheiro, cartão na entrega, cartão online e outros.
- Status pendente, pago, cancelado e estornado.
- Registro do valor recebido e cálculo do troco.
- Tela `/pagamentos` com totais recebidos e pendentes.
- Tabela `order_payments` e políticas por empresa.

## Como ativar
1. Execute as migrações anteriores.
2. Execute `supabase/migrations/0010_order_payments.sql` no Supabase.
3. Inicie o projeto e acesse `/pagamentos`.

## Observação
Esta etapa registra e controla o pagamento. A geração automática de QR Code PIX e a confirmação por um gateway de pagamento ficam para a próxima integração financeira.
