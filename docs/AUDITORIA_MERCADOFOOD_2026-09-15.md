# Auditoria MercadoFood — 15/09/2026

## Escopo
Auditoria inicial executada sobre GitHub, Supabase e Vercel antes de alterações em produção.

## Estado encontrado

### GitHub
- Repositório: `Joarfram/mercadofood`.
- Branch principal: `main`.
- Criada branch segura para correções: `auditoria-mercadofood-2026-09-15`.
- A produção permanece apontando para `main` até validação das correções.

### Vercel
- Projeto: `mercadofood`.
- Deploy de produção encontrado em estado `READY` antes da auditoria.
- A integração com GitHub está ativa e gera previews para branches.
- Não foram encontrados erros ou warnings de runtime na janela de retenção disponível no plano Hobby no momento da consulta.

### Supabase
- Projeto: `mercadofood`.
- Status: `ACTIVE_HEALTHY`.
- Foram encontradas 2 empresas com o mesmo nome `Acarajé da Kelly`.
  - Empresa principal: possui 17 produtos, 24 pedidos e 1 membro.
  - Empresa duplicada de teste: possui 0 produtos, 0 pedidos e 0 membros.
- Ambos os slugs retornam dados pelo RPC do cardápio público.
- Foi encontrado 1 produto com `products.image_url` diferente da imagem principal em `media_assets`: `Fanta 350ml`.
- O dado foi ressincronizado para a imagem principal correta.

## Correção 1 — QR Code do cardápio

### Problema encontrado
A tela de configuração montava o endereço do QR Code usando somente `NEXT_PUBLIC_APP_URL` ou `http://localhost:3000` como fallback. Isso pode gerar QR Code apontando para domínio antigo, ambiente errado ou localhost quando a variável não está configurada corretamente.

### Correção aplicada na branch de auditoria
O QR Code agora usa primeiro a origem real da requisição (`x-forwarded-host`/`host` e `x-forwarded-proto`). A variável `NEXT_PUBLIC_APP_URL` fica como fallback. Dessa forma, ao acessar o MercadoFood pelo domínio final, o QR Code usa esse mesmo domínio automaticamente.

Arquivo alterado:
- `app/(dashboard)/configuracoes/cardapio/page.tsx`

## Segurança Supabase — pontos que exigem revisão
O Supabase Advisor retornou alertas que não devem ser corrigidos automaticamente sem validar a função de cada RPC, pois várias funções públicas são intencionalmente usadas por clientes não autenticados no cardápio.

Pontos encontrados:
- 4 tabelas com RLS habilitado e sem policies explícitas.
- 1 função com `search_path` mutável.
- Diversas funções `SECURITY DEFINER` executáveis por `anon` e/ou `authenticated`.
- Proteção contra senhas vazadas desabilitada no Auth.

### Regra para próxima etapa
Antes de revogar permissões, classificar cada função em:
1. pública e necessária;
2. autenticada e necessária;
3. interna e não deve estar exposta.

Isso evita quebrar cardápio, pedidos, impressão, rastreamento ou convites.

## Próximas prioridades
1. Validar o preview da correção do QR Code.
2. Auditar edição e persistência de produtos no banco.
3. Exibir claramente a foto atual no modal de edição de produto.
4. Auditar troca de imagens e sincronização `media_assets` → `products.image_url`.
5. Testar fluxo completo de pedido e acompanhamento.
6. Auditar impressão em duas vias e fila `print_jobs`.
7. Auditar estoque automático e combos.
8. Revisar responsividade das telas críticas.
9. Revisar os alertas de segurança sem quebrar funções públicas necessárias.
10. Só depois das validações, integrar alterações à `main` e publicar em produção.
