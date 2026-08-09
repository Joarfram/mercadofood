# MercadoFood v2.8

## Novidades da versão

- Dashboard conectado aos pedidos reais da empresa.
- Navegação responsiva no celular e saída segura da conta.
- Recuperação e atualização de senha por e-mail.
- MercadoFood Impulsiona com campanha, orçamento, criativo próprio ou IA paga.
- Aplicativo do entregador instalável, com disponibilidade, GPS e fluxo da corrida.
- Seleção pública de bairro com taxa, prazo e pedido mínimo específicos.
- Página de demonstração pública, termos de uso e privacidade.

## Gerenciamento de imagens

O painel **Fotos e imagens** administra logo e banner; as imagens de produtos,
promoções, combos e campanhas ficam no próprio cadastro. Aplique a migration
`0025_media_management.sql` e consulte
`docs/ETAPA_GERENCIAMENTO_IMAGENS_V26.md`.

Sistema multiempresa para pedidos, cozinha, delivery, pagamentos, estoque,
fidelidade, cardápio público, mesas/comandas, usuários e permissões.

## Requisitos no Windows

- Node.js 20 LTS ou mais recente
- pnpm 11 (`corepack enable` e `corepack prepare pnpm@11.9.0 --activate`)
- Um projeto no Supabase

## Instalação

No PowerShell, dentro da pasta do projeto:

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Edite `.env.local` e preencha:

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública `anon` do Supabase.
- `NEXT_PUBLIC_APP_URL`: endereço do aplicativo; localmente, use
  `http://localhost:3000`.
- `WHATSAPP_WEBHOOK_URL` e `WHATSAPP_WEBHOOK_TOKEN`: opcionais, usados apenas
  pela integração de WhatsApp.

Não use a chave `service_role` no frontend e nunca envie `.env.local` ao
repositório.

## Banco de dados

No Supabase, aplique os arquivos de `supabase/migrations` em ordem crescente
pelo prefixo numérico, de `0001_initial_schema.sql` até
`0038_staff_order_transaction.sql`. A sequência não possui um arquivo `0013`;
isso é intencional e não impede a execução. Não execute `0024` antes das
anteriores, pois ela depende das tabelas `companies` e `company_members`.

Configure também no Supabase Authentication:

1. A URL do site (`http://localhost:3000` no desenvolvimento).
2. A URL de redirecionamento `http://localhost:3000/auth/callback`.
3. O provedor de e-mail e a política de confirmação desejada.
4. Em produção, adicione `https://SEU-DOMINIO/auth/callback` às URLs permitidas.

## Ativação das novas funções

Se o banco já estava configurado até a versão 2.6, aplique somente, nesta ordem:

1. `0029_impulsiona_campaigns.sql` — campanhas e imagens do Impulsiona.
2. `0030_public_delivery_zones.sql` — bairros, taxas e pedido mínimo no checkout.
3. `0031_plan_change_requests.sql` — solicitações de plano e acesso ao Impulsiona.

Depois publique novamente na Vercel. Não exponha a chave `service_role`.

## Teste recomendado antes do piloto

1. Proprietário: entrar, abrir menu no celular, conferir números reais e sair.
2. Cardápio: escolher bairro, montar item, aplicar cupom e enviar pedido.
3. Cozinha: aceitar, preparar e marcar o pedido como pronto.
4. Entrega: cadastrar motoboy, criar sua conta, ficar disponível e aceitar corrida.
5. Cliente: abrir o rastreamento e confirmar que ele termina após a entrega.
6. Impulsiona: criar campanha, trocar o criativo, editar e excluir um rascunho.
7. Segurança: confirmar que um usuário de outra empresa não enxerga esses dados.

O envio real à Meta e a cobrança automática do Impulsiona permanecem desativados
até a conexão formal da conta de anúncios e de um gateway de pagamento.

## Executar

```powershell
pnpm dev
```

Abra `http://localhost:3000`. O login real fica em `/login`; a apresentação
visual de demonstração permanece disponível em `/demonstracao`.

## Validar antes de publicar

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

O build e os fluxos conectados ao banco exigem valores válidos em `.env.local`.
As chaves reais e o envio de mensagens pelo provedor de WhatsApp dependem das
credenciais externas do ambiente de implantação.
