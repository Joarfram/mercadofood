# MercadoFood v0.6 — Cozinha conectada ao Supabase

## Entregas desta etapa

- Painel Kanban com quatro filas: Novos, Aceitos, Em preparo e Prontos.
- Pedidos carregados diretamente do Supabase.
- Itens, cliente, tipo de atendimento, observações e tempo decorrido.
- Atualização segura de status pelo servidor.
- Sincronização do painel por eventos em tempo real do Supabase.
- Busca por pedido, cliente ou produto.
- Índice de banco para melhorar a consulta da fila da cozinha.

## Preparação

1. Execute as migrations em ordem, incluindo `0005_kitchen_realtime.sql`.
2. Configure `.env.local` usando `.env.example`.
3. Crie uma empresa, um produto e um pedido.
4. Abra `/cozinha` para acompanhar o fluxo.

## Fluxo

Novo → Aceito → Em preparo → Pronto → Em entrega

A etapa seguinte conectará pedidos prontos ao módulo de entregadores e criará a atribuição real de motoboy.
