# MercadoFood v2.0 — Mesas e comandas

## Entregas
- Cadastro de mesas e lugares.
- QR Code individual por mesa.
- Abertura de comanda pelo atendente ou automaticamente pelo cliente.
- Pedido público pelo QR Code enviado à cozinha.
- Inclusão de novos pedidos na mesma comanda.
- Soma automática da conta e taxa de serviço configurável.
- Solicitação e fechamento da conta.
- Liberação automática da mesa.

## Rotas
- `/mesas`: gestão do salão.
- `/mesa/[token]`: cardápio público da mesa.

## Banco
Execute `supabase/migrations/0019_tables_tabs_dinein.sql`.
