# MercadoFood Entregador — MVP navegável

## Rotas adicionadas

- `/entregadores`: painel da loja com equipe, status e mapa.
- `/entregador`: protótipo interativo do aplicativo do motoboy.
- `/acompanhar/PEDIDO452`: página pública simulada para o cliente.

## Fluxo testável no app

1. Ativar disponibilidade.
2. Simular nova corrida.
3. Aceitar.
4. Confirmar chegada à loja.
5. Iniciar entrega.
6. Confirmar entrega.

## Banco de dados

A migração `0002_delivery_module.sql` adiciona:

- `drivers`
- `driver_locations`
- `deliveries`
- `delivery_events`

## Limites desta versão

Os mapas e dados são simulados. GPS real, notificações push, autenticação do motoboy, políticas RLS e integração com serviço de mapas entram na próxima etapa técnica.
