# Painel Master e suporte remoto

## O que foi criado

- Painel Master em `/master`, com indicadores de empresas, testes, clientes pagos, bloqueados e testes próximos do fim.
- Lista de empresas com contato, responsável, plano, status, datas e última atividade.
- Administração de assinatura, dias de teste e módulos liberados/bloqueados por empresa.
- Geração de código em `Configurações > Suporte`, com 6 números, uso único e validade padrão de 30 minutos.
- Sessão de suporte vinculada somente à empresa que gerou o código.
- Níveis internos `viewer`, `support` e `master`.
- Auditoria de entrada, saída e alterações, incluindo valores anteriores e posteriores.

## Aplicação da migration

Aplicar `supabase/migrations/20260813043514_master_support_access.sql` primeiro em staging e depois em produção, conforme o processo normal de migrations do projeto.

## Cadastrar o primeiro administrador Master

Depois da migration, identifique o UUID do usuário já criado no Supabase Auth e execute no SQL Editor:

```sql
insert into public.platform_staff(user_id,display_name,support_level)
values ('UUID-DO-USUARIO','Administrador MercadoFood','master')
on conflict(user_id) do update set
  display_name=excluded.display_name,
  support_level=excluded.support_level,
  is_active=true,
  updated_at=now();
```

Nunca promova um usuário a `master` por formulário público ou por `user_metadata`.

## Fluxo de teste recomendado

1. Entrar como proprietário de uma empresa e gerar um código de visualização.
2. Entrar com um membro `viewer` da equipe MercadoFood, resgatar o código e confirmar que nenhuma alteração é permitida.
3. Gerar um código de suporte e resgatá-lo com um membro `support`.
4. Alterar uma configuração simples e confirmar o registro em `support_audit_logs`.
5. Encerrar a sessão e confirmar que o acesso à empresa deixa de funcionar.
6. Tentar reutilizar o código e confirmar a recusa.
7. Confirmar que o mesmo atendente não consegue acessar outra empresa sem um novo código gerado por ela.
