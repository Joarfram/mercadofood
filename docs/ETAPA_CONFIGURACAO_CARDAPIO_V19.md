# MercadoFood v1.9 — Configuração do cardápio e QR Code

## Entregas desta versão
- Personalização de nome, slug, logomarca, banner e cores.
- Mensagem pública e escolha de layout.
- Ativação de delivery, retirada e cardápio.
- Pedido mínimo, taxa padrão e previsão média.
- Endereço e WhatsApp da empresa.
- Horários por dia da semana.
- Bairros/regiões com taxa, mínimo e prazo próprios.
- Geração de QR Code e link público.
- Atalho para adicionais configurados nos produtos.

## Banco de dados
Execute a migration `supabase/migrations/0018_menu_configuration_qr.sql`.

## Variável para o link público
Configure no `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://seudominio.com
```

Em desenvolvimento, o sistema usa `http://localhost:3000`.

## Teste
1. Entre no painel.
2. Abra Configurações > Cardápio e QR Code.
3. Salve aparência e dados.
4. Cadastre horários e bairros.
5. Abra o link público ou leia o QR Code com o celular.
