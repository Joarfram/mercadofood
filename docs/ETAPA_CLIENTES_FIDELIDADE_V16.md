# MercadoFood v1.6 — Clientes e Fidelidade

## Entregas
- Cadastro de clientes com nome, telefone, e-mail, nascimento e observações.
- Consentimento de marketing.
- Histórico de pedidos identificados.
- Total de compras, gasto acumulado e última compra.
- Programa de pontos configurável por empresa.
- Pontos automáticos quando o pedido é entregue.
- Ajustes e resgates manuais.
- Histórico de movimentações de pontos.
- Indicadores de clientes ativos e pontos em circulação.

## Configuração sugerida para teste
- 1 ponto por R$ 1 gasto.
- Pedido mínimo de R$ 0.
- Recompensa: R$ 10 de desconto a cada 100 pontos.

## Banco de dados
Execute a migration `0015_customers_loyalty.sql` após as anteriores.

## Fluxo de teste
1. Cadastre um cliente na tela `/clientes`.
2. Crie um pedido usando o mesmo telefone.
3. Avance o pedido até `Entregue`.
4. Volte a `/clientes` e confira total de pedidos, gasto e pontos.
5. Faça um ajuste ou resgate manual para testar o extrato.
