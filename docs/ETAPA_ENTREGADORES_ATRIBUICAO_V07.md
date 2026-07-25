# MercadoFood v0.7 — Entregadores e atribuição real

Esta etapa substitui o painel demonstrativo de entregadores por dados do Supabase.

## Entregas incluídas

- cadastro de motoboy;
- telefone, WhatsApp, placa e valor padrão por corrida;
- disponibilidade real: disponível ou offline;
- lista de pedidos delivery no status `ready`;
- escolha manual do motoboy;
- criação da entrega em `deliveries`;
- bloqueio do motoboy no status `called`;
- vínculo do pedido ao motoboy;
- histórico inicial em `delivery_events`;
- visualização das corridas ativas.

## Banco de dados

Execute as migrations até `0006_delivery_assignment.sql` no Supabase.

## Teste sugerido

1. Cadastre e faça login na empresa.
2. Cadastre um produto.
3. Crie um pedido do tipo delivery.
4. Leve o pedido até `ready` pelo painel da cozinha.
5. Cadastre um motoboy.
6. Marque-o como disponível.
7. Atribua o pedido na página Entregadores.

## Próxima etapa

Criar a autenticação do motoboy, permitir aceite/recusa no aplicativo, atualizar os status da corrida e registrar GPS real.
