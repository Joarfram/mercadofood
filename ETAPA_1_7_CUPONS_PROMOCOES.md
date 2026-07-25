# MercadoFood v1.7 — Cupons, promoções e recompensas

## Entregas
- Cadastro de cupons percentuais ou de valor fixo.
- Pedido mínimo, desconto máximo, período, limite total e limite por cliente.
- Ativação e desativação de cupons.
- Cadastro de campanhas promocionais.
- Aplicação de cupom diretamente na criação do pedido.
- Resgate da recompensa configurada no programa de fidelidade.
- Registro do desconto, cupom e pontos usados no pedido.
- Histórico de resgates e indicadores básicos.

## Banco de dados
Execute a migration `supabase/migrations/0016_coupons_promotions_rewards.sql`.

## Teste rápido
1. Acesse `/promocoes` e crie um cupom.
2. Garanta que um cliente tenha pontos suficientes em `/clientes`.
3. Crie um pedido em `/pedidos`, informe o código ou marque o resgate.
4. Verifique subtotal, desconto, total, resgate e movimentação dos pontos.

## Observação
A aplicação do cupom é validada no servidor. Para produção em alto volume, o incremento do limite de uso deve ser transformado em uma função transacional no banco para evitar concorrência.
