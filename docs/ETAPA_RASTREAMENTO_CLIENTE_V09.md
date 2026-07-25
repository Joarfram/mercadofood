# MercadoFood v0.9 — Rastreamento do cliente

## Entregas desta etapa

- Página pública em `/acompanhar/[codigo]`.
- Consulta segura por código de rastreamento.
- Atualização automática a cada 10 segundos.
- Etapas da entrega em linha do tempo.
- Nome reduzido do motoboy e do cliente.
- Posição aproximada do entregador somente durante a entrega.
- Mapa OpenStreetMap sem necessidade de chave.
- Encerramento da visualização após a conclusão.
- Função SQL que não expõe telefone, endereço completo, CPF ou histórico integral do GPS.

## Configuração

1. Execute a migration `0008_customer_live_tracking.sql` no Supabase.
2. Confirme que as migrations anteriores também foram aplicadas.
3. Inicie uma entrega e use o `tracking_code` da tabela `deliveries`.
4. Abra: `http://localhost:3000/acompanhar/SEU-CODIGO`.
5. No celular do motoboy, permita o GPS e altere a corrida para `delivering`.

## Observações

- A página usa consulta periódica de 10 segundos, mais simples e robusta para o MVP.
- A posição é arredondada para reduzir precisão excessiva na visualização pública.
- Em produção, o site precisa estar em HTTPS para o GPS do celular funcionar.
- A previsão de chegada automática ficará para a próxima etapa, com serviço de rotas/geocodificação.
