# MercadoFood v1.0 — WhatsApp e link de rastreamento

## O que foi adicionado

- Mensagem pronta para avisar o motoboy sobre uma nova corrida.
- Mensagem pronta para avisar o cliente quando o pedido sair para entrega.
- Link público de rastreamento dentro da mensagem.
- Mensagem de confirmação quando o pedido for entregue.
- Botões de envio manual pelo WhatsApp Web/app.
- Fila e histórico de notificações no Supabase.
- Integração opcional com um provedor externo por webhook.

## Configuração básica

No `.env.local`, defina:

```env
NEXT_PUBLIC_APP_URL=https://seu-dominio.com.br
```

Sem provedor automático, a loja usa os botões de WhatsApp e confirma o envio manualmente.

## Envio automático opcional

Configure um serviço externo que aceite `POST` com telefone e mensagem:

```env
WHATSAPP_WEBHOOK_URL=https://seu-provedor.com/webhook
WHATSAPP_WEBHOOK_TOKEN=token-opcional
```

O MercadoFood envia este formato:

```json
{
  "notification_id": "uuid",
  "phone": "5579999999999",
  "message": "Texto da mensagem",
  "template": "customer_out_for_delivery",
  "metadata": {}
}
```

O webhook é uma camada de adaptação. Assim, o MercadoFood não fica preso a um único fornecedor.

## Quando as mensagens são preparadas

1. Ao atribuir a corrida: mensagem para o motoboy.
2. Ao iniciar a entrega: mensagem para o cliente com o link.
3. Ao concluir: confirmação para o cliente.

## Segurança

- Nunca armazenar senha do WhatsApp.
- Telefones são normalizados antes do envio.
- Cada notificação fica vinculada à empresa e à entrega.
- Falhas ficam registradas para reenvio.
