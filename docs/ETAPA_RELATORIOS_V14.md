# MercadoFood v1.4 — Relatórios e Indicadores

## Entregas desta etapa

- Filtro por data inicial e final.
- Faturamento recebido.
- Ticket médio.
- Total de pedidos, entregues e cancelados.
- Taxa de cancelamento.
- Tempo médio das entregas concluídas.
- Gráfico diário de faturamento.
- Distribuição por forma de pagamento.
- Ranking dos produtos mais vendidos.
- Resumo por delivery, retirada e salão.
- Taxas de entrega e valores de motoboys.

## Nova rota

`/relatorios`

## Como testar

1. Aplique as migrations existentes no Supabase.
2. Cadastre produtos e pedidos.
3. Marque alguns pedidos como pagos e entregues.
4. Abra `/relatorios`.
5. Escolha o período desejado.

Os indicadores respeitam a empresa autenticada por meio das políticas de segurança do Supabase.
