# MercadoFood v0.4 — Supabase real

Esta versão prepara o projeto para autenticação e banco real.

## Entregue
- Login com e-mail e senha.
- Cadastro de empresa.
- Middleware para proteger o painel.
- Cliente Supabase para navegador e servidor.
- Callback de autenticação.
- Estrutura multiempresa.
- Perfis de usuários e permissões básicas.
- Políticas RLS para separar os dados de cada empresa.
- Camada inicial de consultas.

## Para ativar
1. Criar um projeto no Supabase.
2. Copiar `.env.example` para `.env.local`.
3. Preencher URL e chave pública.
4. Executar as migrations em ordem.
5. Ativar autenticação por e-mail no Supabase.
6. Rodar `npm install` e `npm run dev`.

## Limitação atual
Sem as chaves do projeto Supabase, a demonstração local continua sendo o modo disponível. O código está preparado, mas ainda não está conectado a uma conta real.
