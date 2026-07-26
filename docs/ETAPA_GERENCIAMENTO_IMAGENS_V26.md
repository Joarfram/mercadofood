# MercadoFood v2.6 — gerenciamento de imagens

## O que foi adicionado

A página `/midias` centraliza produtos, logomarca, banner do cardápio,
promoções e combos. Usuários autorizados podem adicionar, substituir,
reordenar e remover fotos, com pré-visualização, progresso e confirmação.

## Limites e formatos

- JPG/JPEG, PNG, WebP e GIF.
- Até 8 MB por arquivo.
- Produtos e combos: até 8 fotos.
- Promoções: até 5 fotos.
- Logo e banner: uma imagem de cada tipo.

Sem foto, o cardápio conserva sua imagem padrão. A primeira foto é
sincronizada com os campos atuais (`image_url`, `logo_url` e `banner_url`).

## Configuração do Supabase

1. Aplique primeiro as migrations `0001` até `0024`.
2. Aplique `supabase/migrations/0025_media_management.sql`.
3. Confirme em Storage o bucket público `company-media`.
4. Não crie políticas adicionais: a migration já protege escrita e exclusão.

Os arquivos usam a pasta:

```text
company-media/{company_id}/{entity_type}/{entity_id}/{arquivo}
```

## Permissões

- Proprietário e gerente: todas as imagens.
- Estoque: produtos e combos.
- Outros perfis: sem acesso.

## Teste manual

1. Entre como proprietário e abra **Fotos e imagens**.
2. Envie logo, banner e duas fotos de produto.
3. Inverta a ordem e confirme a nova capa no cardápio público.
4. Substitua e remova uma foto.
5. Teste um PDF, um arquivo maior que 8 MB e o limite de arquivos.
6. Entre como estoque e confirme que identidade e promoções não aparecem.
7. Confirme que um usuário de outra empresa não vê nem altera os arquivos.

## Validação local

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

Use somente a URL e a chave pública do Supabase no `.env.local`. Nunca use
`service_role` no navegador ou no GitHub.
