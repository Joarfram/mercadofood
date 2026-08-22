# Acompanhamento persistente do pedido

## O que foi corrigido

O código público criado no checkout agora acompanha o pedido desde o recebimento, antes mesmo de existir uma entrega ou motoboy. O último pedido também fica salvo no navegador por estabelecimento e reaparece como atalho quando o cliente volta ao cardápio.

## Fluxo do cliente

1. Finaliza um pedido comum ou combo.
2. Recebe número, total e botão de acompanhamento.
3. Ao voltar ao mesmo cardápio no mesmo aparelho, vê o aviso `Você tem o pedido #...`.
4. A página consulta o status a cada 10 segundos: enviado, aceito, preparando, pronto, em entrega e finalizado.

O armazenamento local contém somente código público, número, total e horário. O banco retorna apenas os dados mínimos necessários; não expõe itens, telefone, nome completo nem endereço completo.

## Banco e API

- Migration: `20260822120000_public_order_tracking.sql`.
- RPC pública: `get_public_order_tracking(p_code text)`.
- API: `GET /api/rastreamento/[codigo]`.
- Página: `/acompanhar/[codigo]`.

## Validação

- Criar um pedido e abrir o acompanhamento antes de aceitá-lo.
- Aceitar, iniciar preparo e marcar como pronto, conferindo a atualização automática.
- Voltar ao cardápio e confirmar que o atalho continua visível.
- Repetir para retirada, delivery e combo.
