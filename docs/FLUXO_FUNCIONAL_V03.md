# MercadoFood Starter v0.3 — Fluxo funcional local

Esta versão conecta, em modo demonstrativo local:

1. Criação de pedido
2. Painel da cozinha
3. Pedido pronto
4. Solicitação e atribuição de motoboy
5. Entrega em andamento
6. Acompanhamento do cliente
7. Finalização da entrega

Os dados são salvos no `localStorage` do navegador. Ainda não há banco Supabase real, GPS real, autenticação ou notificações externas.

## Rotas

- `/pedidos`
- `/cozinha`
- `/entregadores`
- `/acompanhar/PEDIDO452`

## Próxima etapa

Substituir o armazenamento local por Supabase, adicionar autenticação e sincronização em tempo real.
