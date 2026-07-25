# MercadoFood v1.2 — PIX, QR Code e Copia e Cola

## Entregas desta versão

- Cadastro da chave PIX da empresa.
- Nome do recebedor e cidade.
- Geração de payload PIX com valor do pedido.
- QR Code e código Copia e Cola.
- TXID baseado no número do pedido.
- Validade visual de 30 minutos para a cobrança.
- Botão para copiar o código.
- Confirmação manual de pagamento.
- Proteção dos dados por empresa no Supabase.

## Como testar

1. Execute a migration `0011_pix_manual_qr.sql`.
2. Acesse `/configuracoes/pix` e salve a chave da empresa.
3. Crie um pedido com forma de pagamento PIX.
4. Acesse `/pagamentos` e abra a cobrança do pedido.
5. Gere o QR Code.
6. Faça um teste de leitura em um aplicativo bancário, sem concluir o pagamento, e confira recebedor e valor.
7. Após conferir o recebimento real, marque o pedido como pago.

## Limitação atual

A confirmação é manual. O MercadoFood não consulta o banco nesta versão. A confirmação automática exigirá integração com um provedor de pagamentos e webhook.
