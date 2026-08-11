# WhatsApp e chatbot — MVP comercial

## Entrega

- Conexão de cada estabelecimento pelo Embedded Signup da Meta.
- Credencial de cada número criptografada com AES-256-GCM.
- Webhook público com validação `X-Hub-Signature-256`.
- Conversas e mensagens separadas por `company_id` e protegidas por RLS.
- Chatbot inicial com cardápio, acompanhamento, informações da loja e transferência para atendente.
- Caixa de conversas na aba Mensagens, com resposta manual e controle bot/atendente.
- Contador de mensagens não lidas na navegação.

## Configuração externa obrigatória

1. Criar o aplicativo empresarial MercadoFood na Meta.
2. Adicionar o produto WhatsApp e criar uma configuração de Embedded Signup.
3. Solicitar na revisão do aplicativo o acesso avançado exigido pela Meta.
4. Configurar o webhook como `https://SEU-DOMINIO/api/whatsapp/webhook`.
5. Assinar o campo de mensagens do WhatsApp Business Account.
6. Cadastrar na hospedagem todas as variáveis listadas em `.env.example`.

## Segurança

- `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TOKEN_ENCRYPTION_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são somente do servidor.
- Nunca copiar credenciais de uma empresa para outra.
- Nunca registrar tokens completos nos logs.
- A rota de conexão exige sessão, módulo liberado e papel proprietário ou gerente.
- A rota de webhook rejeita assinaturas inválidas antes de processar o corpo.

## Banco

Migration: `20260811200334_whatsapp_embedded_onboarding.sql`.

Tabelas:

- `whatsapp_integrations`
- `whatsapp_conversations`
- `whatsapp_messages`

## Limites do MVP

- Respostas automáticas são determinísticas, sem IA generativa.
- Imagens, áudios e documentos recebidos são registrados pelo tipo, mas o conteúdo não é baixado.
- Mensagens iniciadas fora da janela permitida pelo WhatsApp exigirão templates aprovados em uma etapa posterior.
