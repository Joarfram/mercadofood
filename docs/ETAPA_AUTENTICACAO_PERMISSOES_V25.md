# MercadoFood v2.5 — Autenticação, equipe e permissões

## Entregue
- Papéis: proprietário, gerente, atendente, cozinha, caixa, estoque, motoboy e visualizador.
- Menu filtrado conforme o papel do usuário.
- Convites com link único e validade de sete dias.
- Aceite de convite usando o mesmo e-mail cadastrado.
- Ativação e bloqueio de colaboradores.
- Troca de função pelo proprietário ou gerente.
- Regras RLS e funções de autorização no Supabase.
- Página `/usuarios` para gerenciamento da equipe.
- Página pública `/convite/[token]`.
- Página `/sem-permissao`.

## Instalação
1. Execute as migrations anteriores em ordem.
2. Execute `supabase/migrations/0024_auth_roles_permissions.sql`.
3. Configure `NEXT_PUBLIC_APP_URL` no `.env.local`.
4. Crie a empresa com o proprietário.
5. Acesse `/usuarios`, gere o convite e envie o link.

## Observação
Em produção, recomenda-se enviar o convite por um provedor de e-mail ou WhatsApp. Nesta versão o sistema gera um link seguro para compartilhamento manual.
